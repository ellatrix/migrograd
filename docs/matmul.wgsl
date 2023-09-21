struct Meta {
    M: u32, // Rows of A
    N: u32, // Columns of B
    K: u32, // Columns of A and rows of B, which is the depth of the matrix multiplication
}

@group(1) @binding(0) var<storage,read> array_a: array<f32>;
@group(1) @binding(1) var<storage,read> array_b: array<f32>;

@group(0) @binding(0) var<uniform> uniforms: Meta;
@group(0) @binding(1) var<storage,read_write> array_c: array<f32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var M: u32 = uniforms.M;
    var N: u32 = uniforms.N;
    var K: u32 = uniforms.K;
    var x: u32 = global_id.x;
    var y: u32 = global_id.y;

    if (x >= N || y >= M) {
        return;
    }

    var sum: f32 = 0.0;

    for (var k: u32 = 0u; k < K; k = k + 1u) {
        var arow: f32 = array_a[y * K + k];
        var brow: f32 = array_b[k * N + x];
        sum = sum + arow * brow;
    }

    array_c[x + y * N] = sum;
}