#!/usr/bin/env python3
"""修复 Android build.gradle 的 Kotlin stdlib 重复类冲突"""
import re
import sys

build_gradle = sys.argv[1] if len(sys.argv) > 1 else 'android/app/build.gradle'

with open(build_gradle) as f:
    content = f.read()

# 在文件顶部添加 configurations.all 排除旧版 jdk7/jdk8 stdlib
config_block = '''// Fix Kotlin stdlib duplicate classes (added by CI)
configurations.all {
    resolutionStrategy.eachDependency { details ->
        if (details.requested.group == 'org.jetbrains.kotlin'
            && (details.requested.name == 'kotlin-stdlib-jdk7'
                || details.requested.name == 'kotlin-stdlib-jdk8')) {
            details.useVersion('1.8.22')
            details.because('Avoid duplicate classes with kotlin-stdlib 1.8.22')
        }
    }
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7'
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk8'
}

'''

# 插入到文件开头（apply plugin 之后）
if 'exclude group: \'org.jetbrains.kotlin\', module: \'kotlin-stdlib-jdk7\'' not in content:
    # 找到第一个 apply 之后的位置
    m = re.search(r'(apply plugin:[^\n]+\n)', content)
    if m:
        insert_pos = m.end()
        content = content[:insert_pos] + '\n' + config_block + content[insert_pos:]
    else:
        content = config_block + content

with open(build_gradle, 'w') as f:
    f.write(content)

print('Fixed Kotlin stdlib conflict')