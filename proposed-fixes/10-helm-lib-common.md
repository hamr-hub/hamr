# P0-10: helm-charts/lib-common 空目录

**子项目**: `hamr-infra`
**严重度**: P0 ship-blocker (Cluster 6)
**审计来源**: `.iter-skill/runs/2026-06-30/06-dev-infra.md` Top 1

## 背景

`hamr-infra/helm-charts/lib-common/` 目录存在但空（只有 `Chart.yaml`），所有子项目 chart 引用它但什么都渲染不出来。

## 修复

创建 5 个核心模板：

### `lib-common/templates/_deployment.tpl`

```yaml
{{- /* hamr.commonDeployment — 标准 Deployment */ -}}
{{- define "hamr.commonDeployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .service }}
  labels:
    {{- include "hamr.commonLabels" . | nindent 4 }}
    app.kubernetes.io/component: {{ .service }}
spec:
  replicas: {{ .replicas | default 2 }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .service }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    metadata:
      labels:
        {{- include "hamr.commonLabels" . | nindent 8 }}
        app.kubernetes.io/component: {{ .service }}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: "/metrics"
        prometheus.io/port: "8080"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: {{ .service }}
          image: "{{ .image.repository }}:{{ .image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .image.pullPolicy | default "IfNotPresent" }}
          ports:
            - name: http
              containerPort: {{ .port | default 8080 }}
          envFrom:
            - configMapRef:
                name: {{ .service }}-env
            - secretRef:
                name: {{ .service }}-secrets
          livenessProbe:
            httpGet: { path: /healthz, port: http }
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /readyz, port: http }
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: {{ .resources.requests.cpu | default "100m" }}
              memory: {{ .resources.requests.memory | default "128Mi" }}
            limits:
              cpu: {{ .resources.limits.cpu | default "500m" }}
              memory: {{ .resources.limits.memory | default "512Mi" }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
{{- end -}}
```

### `lib-common/templates/_service.tpl`

```yaml
{{- /* hamr.commonService */ -}}
{{- define "hamr.commonService" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .service }}
  labels:
    {{- include "hamr.commonLabels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: {{ .service }}
    app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
```

### `lib-common/templates/_networkpolicy.tpl`

```yaml
{{- /* hamr.commonNetworkPolicy */ -}}
{{- define "hamr.commonNetworkPolicy" -}}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .service }}
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: {{ .service }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { name: ingress-nginx } }
      ports: [{ port: 8080, protocol: TCP }]
  egress:
    - to: []  # 默认 deny
    - to:
        - namespaceSelector: {}
      ports:
        - port: 5432  # PostgreSQL
          protocol: TCP
        - port: 6379  # Redis
          protocol: TCP
        - port: 443   # HTTPS
          protocol: TCP
        - port: 53    # DNS
          protocol: UDP
{{- end -}}
```

### `lib-common/templates/_pdb.tpl`

```yaml
{{- /* hamr.commonPDB */ -}}
{{- define "hamr.commonPDB" -}}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ .service }}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .service }}
      app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
```

### `lib-common/templates/_externalsecret.tpl`

```yaml
{{- /* hamr.commonExternalSecret */ -}}
{{- define "hamr.commonExternalSecret" -}}
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{ .service }}-secrets
spec:
  secretStoreRef:
    name: hamr-vault
    kind: ClusterSecretStore
  target:
    name: {{ .service }}-secrets
    creationPolicy: Owner
  data:
    {{- range .secrets }}
    - secretKey: {{ .key }}
      remoteRef:
        key: {{ .remoteKey | default (printf "secret/%s/%s" $.service .key) }}
        property: {{ .property | default .key }}
    {{- end }}
{{- end -}}
```

### `lib-common/templates/_helpers.tpl`

```yaml
{{- /* hamr.commonLabels */ -}}
{{- define "hamr.commonLabels" -}}
app.kubernetes.io/name: {{ .service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | default "0.1.0" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hamr
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}
```

### `lib-common/Chart.yaml`

```yaml
apiVersion: v2
name: lib-common
description: HamR shared Helm library chart
type: library
version: 0.1.0
appVersion: "0.1.0"
```

## 验证

```bash
cd hamr-infra/helm-charts/lib-common
helm lint .
helm template test .
# 期望：所有 include 至少不报错
```

子项目 chart 用法：

```yaml
# hamr-api/charts/hamr-api/Chart.yaml
dependencies:
  - name: lib-common
    version: 0.1.0
    repository: file://../../hamr-infra/helm-charts/lib-common
```

```yaml
# hamr-api/charts/hamr-api/templates/deployment.yaml
{{- include "hamr.commonDeployment" (dict "service" "hamr-api" "Release" .Release "Chart" .Chart "port" 8080) }}
```