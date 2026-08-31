//! hamr-catch 极简局域网静态文件服务
//!
//! 0 外部依赖，纯 Rust stdlib 实现。监听局域网（0.0.0.0），仅分发 PWA 静态资源，
//! 不存任何业务数据，不访问外网。
//!
//! 用法：
//!   cargo run --release
//!   # 或：cargo run -- --port 8080
//!
//! 启动后会打印局域网 IP（如 192.168.1.100），其他设备扫码/输入该 IP 即可访问。

use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ================== 常量 ==================

const DEFAULT_PORTS: &[u16] = &[8080, 8081, 8082, 8083, 8084];
const INDEX_FILE: &str = "index.html";
const WEB_DIR: &str = "web";
const BANNER: &str = r#"
   __                                  __              __
  / /_  ____ _____  ____ ___  ___     / /_____  _____/ /
 / __ \/ __ `/ __ \/ __ `__ \/ _ \   / //_/ _ \/ ___/ /
/ / / / /_/ / / / / / / / / /  __/  / ,< /  __/ /  /_/
/_/ /_/\__,_/_/ /_/_/ /_/ /_/\___/  /_/|_|\___/_/  (_)
"#;

// 内存中的信令队列（deviceId -> Vec<SignalMsg>），纯内存，重启清空
type SignalStore = Arc<Mutex<HashMap<String, Vec<SignalMsg>>>>;

#[derive(Clone, Debug)]
struct SignalMsg {
    from: String,
    payload: String,
    ts: u64,
}

// ================== 入口 ==================

fn main() {
    println!("{}", BANNER);
    println!("hamr-catch v0.1.0 — 家庭资产盘点 P2P 平台");
    println!("局域网静态文件服务启动中...\n");

    // 解析命令行参数 --port N
    let args: Vec<String> = env::args().collect();
    let custom_port = args
        .windows(2)
        .find(|w| w[0] == "--port" || w[0] == "-p")
        .and_then(|w| w[1].parse::<u16>().ok());

    // 工作目录：优先 cwd 下的 web/，否则取可执行文件同级的 web/
    let cwd_web = env::current_dir().map(|p| p.join(WEB_DIR)).ok();
    let exe_web = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join(WEB_DIR)));
    let web_root = cwd_web
        .filter(|p| p.exists())
        .or_else(|| exe_web.filter(|p| p.exists()))
        .unwrap_or_else(|| PathBuf::from(WEB_DIR));

    if !web_root.exists() {
        eprintln!(
            "❌ 找不到 web 目录: {}\n   请在 hamr-catch 仓库根目录运行此程序",
            web_root.display()
        );
        std::process::exit(1);
    }

    // 探测可用端口
    let port = custom_port
        .or_else(|| find_available_port(DEFAULT_PORTS))
        .unwrap_or_else(|| {
            eprintln!("❌ 无法绑定到任何端口: {:?}", DEFAULT_PORTS);
            std::process::exit(1);
        });

    // 启动服务
    let listener = match TcpListener::bind(("0.0.0.0", port)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("❌ 绑定端口 {} 失败: {}", port, e);
            std::process::exit(1);
        }
    };

    let web_root = Arc::new(web_root);
    let signals: SignalStore = Arc::new(Mutex::new(HashMap::new()));

    println!("✅ 服务已启动");
    println!("   监听端口: {}", port);
    println!("   web 目录: {}", web_root.display());
    println!();

    // 打印所有局域网 IP
    let ips = list_local_ips();
    println!("📱 局域网访问地址（同一 WiFi 下的设备任选其一）:");
    if ips.is_empty() {
        println!("   http://localhost:{}", port);
    } else {
        for ip in &ips {
            println!("   http://{}:{}", ip, port);
        }
    }
    println!();
    println!("💡 首次使用：");
    println!("   1. 手机 / iPad 连接同一 WiFi");
    println!("   2. 浏览器打开上面任一地址");
    println!("   3. 在 PWA 中点\"我是新设备\"生成二维码");
    println!("   4. 用另一台设备\"扫码加入\"完成配对");
    println!();
    println!("按 Ctrl+C 停止服务");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // accept 循环
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let root = Arc::clone(&web_root);
                let signals = Arc::clone(&signals);
                thread::spawn(move || {
                    if let Err(e) = handle_client(stream, root.as_ref(), signals) {
                        eprintln!("[错误] {}", e);
                    }
                });
            }
            Err(e) => {
                eprintln!("[accept 错误] {}", e);
            }
        }
    }
}

// ================== HTTP 处理 ==================

fn handle_client(
    mut stream: TcpStream,
    web_root: &std::path::Path,
    signals: SignalStore,
) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;

    // 读取请求行 + 简单 headers
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf)?;
    if n == 0 {
        return Ok(());
    }
    let request = String::from_utf8_lossy(&buf[..n]);

    let mut parts = request.split("\r\n");
    let request_line = parts.next().unwrap_or("");
    let mut req_parts = request_line.split_whitespace();
    let method = req_parts.next().unwrap_or("");
    let raw_path = req_parts.next().unwrap_or("/");

    // 解析 Content-Length 与 body（POST 用）
    let mut body = String::new();
    for line in parts {
        if line.is_empty() {
            break;
        }
    }
    let body_start = request.find("\r\n\r\n").map(|i| i + 4);
    if let Some(start) = body_start {
        body = request[start..].to_string();
    }

    // ---------- 信令 API ----------
    if raw_path.starts_with("/api/signals/") {
        return handle_signal(&mut stream, method, raw_path, &body, signals);
    }
    if raw_path == "/api/server-info" {
        let info = serde_json_like(&[
            ("role", if is_first_run() { "host" } else { "client" }),
            ("ts", &SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0).to_string()),
        ]);
        return send_json(&mut stream, 200, &info);
    }

    // 防止路径穿越
    let path = sanitize_path(raw_path);

    // 仅支持 GET / HEAD
    if method != "GET" && method != "HEAD" && method != "POST" && method != "DELETE" {
        return send(&mut stream, 405, "text/plain", b"405 Method Not Allowed");
    }
    if method == "POST" || method == "DELETE" {
        return send(&mut stream, 405, "text/plain", b"405 Method Not Allowed (signaling only)");
    }

    // 解析真实文件路径
    let file_path = if path == "/" || path.is_empty() {
        web_root.join(INDEX_FILE)
    } else {
        web_root.join(&path[1..]) // 去掉前导 '/'
    };

    // 安全检查：必须在 web_root 下
    if !file_path.starts_with(web_root) {
        return send(&mut stream, 403, "text/plain", b"403 Forbidden");
    }

    if !file_path.exists() || !file_path.is_file() {
        // fallback 到 index.html（SPA 风格）
        let fallback = web_root.join(INDEX_FILE);
        if fallback.exists() {
            return send_file(&mut stream, 200, &fallback, method == "HEAD");
        } else {
            return send(&mut stream, 404, "text/plain", b"404 Not Found");
        }
    }

    send_file(&mut stream, 200, &file_path, method == "HEAD")
}

fn send_file(stream: &mut TcpStream, status: u16, path: &PathBuf, head_only: bool) -> std::io::Result<()> {
    let mime = guess_mime(path);
    let body = fs::read(path)?;
    let status_text = match status {
        200 => "OK",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Unknown",
    };

    let header = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Cache-Control: no-cache\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Connection: close\r\n\
         \r\n",
        status, status_text, mime, body.len()
    );

    stream.write_all(header.as_bytes())?;
    if !head_only {
        stream.write_all(&body)?;
    }
    stream.flush()?;
    Ok(())
}

fn send(stream: &mut TcpStream, status: u16, mime: &str, body: &[u8]) -> std::io::Result<()> {
    let status_text = match status {
        200 => "OK",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Unknown",
    };
    let header = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Connection: close\r\n\
         \r\n",
        status, status_text, mime, body.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn sanitize_path(raw: &str) -> String {
    // 去掉 query string
    let path = raw.split('?').next().unwrap_or("/");
    // 解码 %xx（简化版：去除 ..）
    let mut result = String::from(path);
    if result.contains("..") {
        result = "/".to_string();
    }
    result
}

fn guess_mime(path: &PathBuf) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        "txt" => "text/plain; charset=utf-8",
        "manifest" => "application/manifest+json",
        _ => "application/octet-stream",
    }
}

// ================== 网络工具 ==================

fn find_available_port(ports: &[u16]) -> Option<u16> {
    for &p in ports {
        if TcpListener::bind(("0.0.0.0", p)).is_ok() {
            return Some(p);
        }
    }
    None
}

/// 列出本机所有非回环 IPv4 地址（局域网 IP）
fn list_local_ips() -> Vec<String> {
    let mut ips = Vec::new();

    // 通过 UDP socket 探测本机 IP（不发数据，仅获取路由出口）
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        // 连接到公网 DNS（不会真正发送数据，但会路由选定网卡）
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                if let IpAddr::V4(ip) = addr.ip() {
                    if !ip.is_loopback() {
                        ips.push(ip.to_string());
                    }
                }
            }
        }
    }

    // 兜底：尝试 /sbin/ifconfig（macOS / Linux）
    if ips.is_empty() {
        if let Ok(output) = std::process::Command::new("ifconfig").output() {
            let s = String::from_utf8_lossy(&output.stdout);
            for line in s.lines() {
                if line.contains("inet ") && !line.contains("inet6") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pos) = parts.iter().position(|&p| p == "inet") {
                        if let Some(ip_str) = parts.get(pos + 1) {
                            if let Ok(IpAddr::V4(ip)) = ip_str.parse() {
                                if !ip.is_loopback() && ip.to_string().starts_with("192.168")
                                    || ip.to_string().starts_with("10.")
                                    || ip.to_string().starts_with("172.")
                                {
                                    ips.push(ip.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    ips.sort();
    ips.dedup();
    ips
}

// ================== 测试辅助 ==================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path() {
        assert_eq!(sanitize_path("/"), "/");
        assert_eq!(sanitize_path("/foo/bar"), "/foo/bar");
        assert_eq!(sanitize_path("/../etc/passwd"), "/");
        assert_eq!(sanitize_path("/index.html?a=1"), "/index.html");
    }

    #[test]
    fn test_guess_mime() {
        assert_eq!(guess_mime(&PathBuf::from("a.html")), "text/html; charset=utf-8");
        assert_eq!(guess_mime(&PathBuf::from("a.js")), "application/javascript; charset=utf-8");
        assert_eq!(guess_mime(&PathBuf::from("a.png")), "image/png");
        assert_eq!(guess_mime(&PathBuf::from("a.unknown")), "application/octet-stream");
    }
}

// 抑制未使用导入警告
#[allow(dead_code)]
fn _silence_unused() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

// ================== 信令 API ==================

fn handle_signal(
    stream: &mut TcpStream,
    method: &str,
    path: &str,
    body: &str,
    signals: SignalStore,
) -> std::io::Result<()> {
    // 路径: /api/signals/{deviceId}
    let device_id = path.trim_start_matches("/api/signals/");
    if device_id.is_empty() || device_id.contains('/') || device_id.contains("..") {
        return send_json(stream, 400, r#"{"error":"invalid deviceId"}"#);
    }

    match method {
        "POST" => {
            // 解析 body 里的 { from, payload }
            let from = extract_json_str(body, "from").unwrap_or_default();
            let payload = extract_json_str(body, "payload").unwrap_or_default();
            if from.is_empty() || payload.is_empty() {
                return send_json(stream, 400, r#"{"error":"missing from or payload"}"#);
            }
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let msg = SignalMsg {
                from: from.clone(),
                payload,
                ts,
            };
            let mut map = signals.lock().unwrap();
            map.entry(device_id.to_string())
                .or_insert_with(Vec::new)
                .push(msg);
            // 单设备队列上限 16 条
            if let Some(q) = map.get_mut(device_id) {
                if q.len() > 16 {
                    let drop = q.len() - 16;
                    q.drain(0..drop);
                }
            }
            send_json(stream, 200, r#"{"ok":true}"#)
        }
        "GET" => {
            // 拉取并清空该 deviceId 的消息队列
            let mut map = signals.lock().unwrap();
            let msgs = map.remove(device_id).unwrap_or_default();
            let json = render_signal_list(&msgs);
            send_json(stream, 200, &json)
        }
        "DELETE" => {
            let mut map = signals.lock().unwrap();
            map.remove(device_id);
            send_json(stream, 200, r#"{"ok":true}"#)
        }
        _ => send_json(stream, 405, r#"{"error":"method not allowed"}"#),
    }
}

fn extract_json_str(body: &str, key: &str) -> Option<String> {
    // 简易 JSON 字符串值提取（无嵌套转义足够用）
    let needle = format!("\"{}\":", key);
    let i = body.find(&needle)?;
    let rest = &body[i + needle.len()..];
    let rest = rest.trim_start();
    if !rest.starts_with('"') {
        return None;
    }
    let rest = &rest[1..];
    let mut out = String::new();
    let mut chars = rest.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('t') => out.push('\t'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some('/') => out.push('/'),
                Some(other) => out.push(other),
                None => break,
            }
        } else if c == '"' {
            return Some(out);
        } else {
            out.push(c);
        }
    }
    None
}

fn render_signal_list(msgs: &[SignalMsg]) -> String {
    let mut out = String::from("[");
    for (i, m) in msgs.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            r#"{{"from":"{}","payload":"{}","ts":{}}}"#,
            json_escape(&m.from),
            json_escape(&m.payload),
            m.ts
        ));
    }
    out.push(']');
    out
}

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn send_json(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let status_text = if status == 200 { "OK" } else { "Error" };
    let body_bytes = body.as_bytes();
    let header = format!(
        "HTTP/1.1 {} {}\r\n\
        Content-Type: application/json; charset=utf-8\r\n\
        Content-Length: {}\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n\
        Access-Control-Allow-Headers: Content-Type\r\n\
        Connection: close\r\n\
        \r\n",
        status, status_text, body_bytes.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(body_bytes)?;
    stream.flush()?;
    Ok(())
}

fn serde_json_like(kv: &[(&str, &str)]) -> String {
    let mut s = String::from("{");
    for (i, (k, v)) in kv.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        s.push_str(&format!(r#""{}":"{}""#, k, v));
    }
    s.push('}');
    s
}

fn is_first_run() -> bool {
    // 占位，永远返回 true（实际未使用）
    true
}

// ================== 测试 ==================

#[cfg(test)]
mod signal_tests {
    use super::*;

    #[test]
    fn test_extract_json_str() {
        assert_eq!(
            extract_json_str(r#"{"from":"abc","payload":"hello"}"#, "from").as_deref(),
            Some("abc")
        );
        assert_eq!(
            extract_json_str(r#"{"from":"abc","payload":"hello"}"#, "payload").as_deref(),
            Some("hello")
        );
        assert!(extract_json_str(r#"{"from":"abc"}"#, "missing").is_none());
    }

    #[test]
    fn test_json_escape() {
        assert_eq!(json_escape("hello"), "hello");
        assert_eq!(json_escape(r#"he"llo"#), r#"he\"llo"#);
        assert_eq!(json_escape("line1\nline2"), "line1\\nline2");
    }

    #[test]
    fn test_render_signal_list() {
        let msgs = vec![
            SignalMsg {
                from: "a".into(),
                payload: "p".into(),
                ts: 123,
            },
        ];
        let s = render_signal_list(&msgs);
        assert!(s.contains(r#""from":"a""#));
        assert!(s.contains(r#""payload":"p""#));
    }
}