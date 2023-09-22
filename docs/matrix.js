function empty( shape ) {
    const array = new Float32Array( shape.reduce( ( a, b ) => a * b, 1 ) );
    array.shape = shape;
    return array;
}

function clone( array ) {
    const clone = new Float32Array( array );
    clone.shape = array.shape;
    return clone;
}

function softmaxByRow( A ) {
    const [m, n] = A.shape;
    const B = empty(A.shape);
    for ( let m_ = m; m_--; ) {
        let max = -Infinity;
        for ( let n_ = n; n_--; ) {
            const value = A[m_ * n + n_];
            if (value > max) max = value;
        }
        let sum = 0;
        for ( let n_ = n; n_--; ) {
            const i = m_ * n + n_;
            // Subtract the max to avoid overflow
            sum += B[i] = Math.exp(A[i] - max);
        }
        for ( let n_ = n; n_--; ) {
            B[m_ * n + n_] /= sum;
        }
    }
    return B;
}

function add( A, B ) {
    if ( A.shape.toString() !== B.shape.toString() ) {
        throw new Error( 'Matrix dimensions do not match.' );
    }

    const C = empty( A.shape );
    for ( let i = A.length; i--; ) C[ i ] = A[ i ] + B[ i ];
    return C;
}

function maybeAdd( a, b ) {
    return a ? add( a, b ) : b;
}

function transpose( A ) {
    const [ m, n ] = A.shape;
    const B = empty( [ n, m ] );

    for ( let m_ = m; m_--; )
        for ( let n_ = n; n_--; )
            B[n_ * m + m_] = A[m_ * n + n_];

    return B;
}

class Layer {
    constructor( data ) {
        this.data = data;
        this.grad = undefined;
        this._backward = async () => {};
        this._forward = async () => {};
        this._prev = new Set();
        return this;
    }
    matMul( other ) {
        const matMul = Layer.gpu ? Layer.gpu.matMul : Layer.cpu.matMul;
        other = other instanceof Layer ? other : new Layer( other );
        const out = new Layer();
        out._operation = 'matMul';
        this._prev = new Set( [ this, other ] );
        out._forward = async () => {
            await this._forward();
            await other._forward();
            out.data = await matMul( this.data, other.data );
        };
        out._backward = async () => {
            // Gradient with respect to this.data.
            this.grad = maybeAdd( this.grad, await matMul( out.grad, transpose( other.data ) ) );
            // Gradient with respect to other.data.
            other.grad = maybeAdd( other.grad, await matMul( transpose( this.data ), out.grad ) );
        };
        return out;
    }
    softmaxCrossEntropy( onehotLabels ) {
        const out = new Layer();
        out._operation = 'softmaxCrossEntropy';
        out._prev = new Set( [ this ] );
        out._forward = async () => {
            await this._forward();
            const logits = this.data;
            // Probabilites.
            const R = softmaxByRow( logits );
            this.sofmaxResult = clone( R );
            const [ m, n ] = R.shape;

            for ( let m_ = m; m_--; ) {
                for ( let n_ = n; n_--; ) {
                    const i = m_ * n + n_;
                    // Calculate the logProbs (log likelihoods).
                    R[i] = Math.log( R[i] );
                    // Multiply by the onehotLabels.
                    R[i] *= onehotLabels[i];
                }
            }

            let sum = 0;
            for ( let i = R.length; i--; ) sum += R[i];
            // Account for the 0s, so divide by the number of rows.
            const mean = sum / R.shape[ 0 ];
            // Loss = average negative log likelihood.
            out.data = empty( [] ).fill( - mean );
        };
        out._backward = async () => {
            const B = this.sofmaxResult;
            const [m, n] = B.shape;

            for ( let m_ = m; m_--; ) {
                for ( let n_ = n; n_--; ) {
                    const i = m_ * n + n_;
                    // Subtract the onehotLabels.
                    B[i] -= onehotLabels[i];
                    // Divide by the number of rows.
                    B[i] /= m;
                }
            }

            this.grad = maybeAdd( this.grad, B );
        };
        return out;
    }
    async forward() {
        await this._forward();
    }
    async backward() {
        const reversed = [ ...this.getTopo() ].reverse();

        for ( const node of reversed ) {
            node.grad = null;
        }

        this.grad = empty( this.data.shape ).fill( 1 );

        for ( const node of reversed ) {
            await node._backward();
        }
    }
    getTopo() {
        if ( this.topo ) {
            return this.topo;
        }

        this.topo = [];

        const visited = new Set();

        const buildTopo = ( node ) => {
            if ( ! visited.has( node ) ) {
                visited.add( node );

                for ( const child of node._prev ) {
                    buildTopo( child );
                }

                this.topo.push( node );
            }
        }

        buildTopo( this );

        return this.topo;
    }
}

Layer.cpu = { matMul }
