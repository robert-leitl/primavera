#version 300 es

uniform mat4 u_worldMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_worldInverseTransposeMatrix;
uniform vec3 u_cameraPosition;

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;
in mat4 a_instanceMatrix;

out vec3 v_position;
out vec3 v_viewPosition;
out vec3 v_normal;
out vec3 v_viewNormal;
out vec2 v_uv;
out vec3 v_surfaceToView;

void main() {
    v_uv = a_uv;
    v_normal = (u_worldInverseTransposeMatrix * a_instanceMatrix * vec4(a_normal, 0.)).xyz;
    vec4 worldPosition = u_worldMatrix * a_instanceMatrix * vec4(a_position, 1.);
    vec4 viewPosition = u_viewMatrix * worldPosition;
    gl_Position = u_projectionMatrix * viewPosition;
    v_surfaceToView = u_cameraPosition - worldPosition.xyz;
    v_position = a_position.xyz;
    v_viewPosition = viewPosition.xyz;
    v_viewNormal = (u_viewMatrix * vec4(v_normal, 0.)).xyz;

    gl_PointSize = 2.;
}
