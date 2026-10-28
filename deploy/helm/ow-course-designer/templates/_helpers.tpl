{{- define "owcd.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "owcd.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "owcd.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "owcd.labels" -}}
helm.sh/chart: {{ include "owcd.chart" . }}
{{ include "owcd.selectorLabels" . }}
app.kubernetes.io/version: {{ include "owcd.imageTag" . | trunc 63 | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: ow-course-designer
{{- end }}

{{- define "owcd.selectorLabels" -}}
app.kubernetes.io/name: {{ include "owcd.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "owcd.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "owcd.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "owcd.imageTag" -}}
{{- default .Chart.AppVersion .Values.image.tag }}
{{- end }}

{{- define "owcd.image" -}}
{{- printf "%s:%s" .Values.image.repository (include "owcd.imageTag" .) }}
{{- end }}

{{/* Name of the Secret with AUTH_SECRET, the Maps key and the SMTP login. */}}
{{- define "owcd.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- printf "%s-secrets" (include "owcd.fullname" .) }}
{{- end }}
{{- end }}

{{- define "owcd.claimName" -}}
{{- default (printf "%s-data" (include "owcd.fullname" .)) .Values.persistence.existingClaim }}
{{- end }}
