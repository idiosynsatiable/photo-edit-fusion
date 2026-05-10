import type { BlendMode } from '@pef/shared';
import { buildFragmentShader, VERTEX_SHADER } from './blend-shaders.js';

/**
 * Compiles and caches one program per blend mode and composites pairs of
 * textures onto the bound framebuffer. Designed to be created once and
 * reused — calls compositeTexture per layer, in render order.
 */
export class WebGLCompositor {
  private gl: WebGL2RenderingContext;
  private programs = new Map<BlendMode, WebGLProgram>();
  private vao: WebGLVertexArrayObject;
  private fullscreenQuad: WebGLBuffer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to allocate VAO');
    this.vao = vao;
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to allocate quad buffer');
    this.fullscreenQuad = buf;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // pos.x, pos.y, uv.x, uv.y
    const data = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  private getProgram(mode: BlendMode): WebGLProgram {
    const cached = this.programs.get(mode);
    if (cached) return cached;
    const program = compileProgram(this.gl, VERTEX_SHADER, buildFragmentShader(mode));
    this.programs.set(mode, program);
    return program;
  }

  /** Composites src on top of base into the currently bound framebuffer. */
  compositeTexture(opts: {
    base: WebGLTexture;
    src: WebGLTexture;
    mode: BlendMode;
    opacity: number;
  }): void {
    const gl = this.gl;
    const program = this.getProgram(opts.mode);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const uvLoc = gl.getAttribLocation(program, 'a_uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenQuad);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, opts.base);
    gl.uniform1i(gl.getUniformLocation(program, 'u_base'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, opts.src);
    gl.uniform1i(gl.getUniformLocation(program, 'u_src'), 1);

    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opts.opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const p of this.programs.values()) gl.deleteProgram(p);
    this.programs.clear();
    gl.deleteBuffer(this.fullscreenQuad);
    gl.deleteVertexArray(this.vao);
  }
}

function compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'unknown';
    gl.deleteProgram(prog);
    throw new Error(`Program link failed: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown';
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}\n${src}`);
  }
  return shader;
}
