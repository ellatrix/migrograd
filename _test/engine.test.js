const table = document.createElement('table');

document.body.appendChild(table);

function t(value) {
    return tf.tensor(value.data, value.data.shape);
}

function addRow(op, compare) {
    const row = document.createElement('tr');
    const opCell = document.createElement('td');
    opCell.textContent = op;
    row.appendChild(opCell);

    compare.forEach(([mgValues, tfValues]) => {
        tfValues = tfValues.arraySync();
        let diff;
        if (mgValues.length) {
            tfValues = tfValues.flatMap( ( v ) => v );
            diff = Math.max(...[...mgValues].map((v, i) => Math.abs(v - tfValues[i])));
        } else {
            diff = Math.abs(mgValues - tfValues);
        }
        const diffCell = document.createElement('td');
        if (diff === 0) {
            diffCell.textContent = '0';
        } else {
            const magnitude = Math.floor(Math.log10(diff));
            diffCell.textContent = `1e${magnitude}`;
        }
        row.appendChild(diffCell);
    });

    table.appendChild(row);
}

async function test_matrix_ops() {
    {
        const op = 'matMul';
        const x = new Value( new FloatMatrix( [ 1, 2, 3, 4 ], [ 2, 2 ] ) );
        const y = new Value( new FloatMatrix( [ 5, 6, 7, 8 ], [ 2, 2 ] ) );
        const z = x.matMulBias( y, new FloatMatrix( [ 0, 0 ], [ 2 ] ) );
        await z.forward();
        await z.backward();
        const f = ( x, y ) => x[ op ]( y );
        const [ tfGradX, tfGradY ] = tf.grads( f )( [ t( x ), t( y ) ] );
        addRow( op, [
            [ z.data, f( t( x ), t( y ) ) ],
            [ x.grad, tfGradX ],
            [ y.grad, tfGradY ]
        ] );
    }

    {
        const op = 'matMulBias';
        const x = new Value( new FloatMatrix( [ 1, 2, 3, 4 ], [ 2, 2 ] ) );
        const y = new Value( new FloatMatrix( [ 5, 6, 7, 8 ], [ 2, 2 ] ) );
        const b = new Value( new FloatMatrix( [ 1, 1 ], [ 2 ] ) );
        const z = x.matMulBias( y, b );
        await z.forward();
        await z.backward();
        console.log(z)
        const f = ( x, y, b ) => x.matMul( y ).add( b );
        const [ tfGradX, tfGradY, tfGradB ] = tf.grads( f )( [ t( x ), t( y ), t( b ) ] );
        addRow( op, [
            [ z.data, f( t( x ), t( y ), t( b ) ) ],
            [ x.grad, tfGradX ],
            [ y.grad, tfGradY ],
            [ b.grad, tfGradB ]
        ] );
    }

    {
        const op = 'softmaxCrossEntropy';
        const x = new Value( new FloatMatrix( [ 1, 2, 3, 4 ],  [ 2, 2 ] ) );
        const y = new IntMatrix( [ 1, 0 ], [ 2 ] );
        const z = x[ op ]( y );
        await z.forward();
        await z.backward();
        const f = ( x ) => tf.losses[ op ]( [[0,1],[1,0]], x );
        const tfGradX = tf.grad( f )( t( x ) );
        addRow( op, [
            [ z.data, f( t( x ) ) ],
            [ x.grad, tfGradX ]
        ] );
    }

    function batchNorm(x, gain, bias, epsilon = 1e-5) {
        const moments = tf.moments(x, 0);
        const mean = moments.mean;
        let correctedVariance = moments.variance;
        // const normalized = tf.div(tf.sub(x, mean), tf.sqrt(tf.add(variance, epsilon)));
        // return tf.add(tf.mul(normalized, gain), bias);
        // Apply Bessel's correction to variance
        const n = x.shape[0];
        correctedVariance = tf.mul(correctedVariance, n / (n - 0));
        return tf.batchNorm(
            x,
            mean,
            correctedVariance,
            bias,
            gain,
            epsilon
        );
    }

    {
        const op = 'batchNorm';
        const A = new Value( new FloatMatrix( [ 0.5, 0.5, 0.1, 0.9 ], [ 2, 2 ] ) );
        const gain = new Value( new FloatMatrix( [ 0.1, 0.1 ], [ 2 ] ) );
        const bias = new Value( new FloatMatrix( [ 0.2, 0.2 ], [ 2 ] ) )
        const bnout = A[ op ]( gain, bias );
        await bnout.forward();
        await bnout.backward();
        const [ tfGradX, tfGradY, tfGradZ ] = tf.grads( batchNorm )( [ t( A ), t( gain ), t( bias ) ] );
        addRow( op, [
            [ bnout.data, batchNorm( t( A ), t( gain ), t( bias ) ) ],
            [ A.grad, tfGradX ],
            [ gain.grad, tfGradY ],
            [ bias.grad, tfGradZ ]
        ] );
    }

    {
        const op = 'tanh';
        const A = new Value( new FloatMatrix( [ 0.5, 0.5, 0.1, 0.9 ], [ 2, 2 ] ) );
        const tanhout = A[ op ]();
        await tanhout.forward();
        await tanhout.backward();
        const f = ( x ) => x[ op ]();
        addRow( op, [
            [ tanhout.data, f( t( A ) ) ],
            [ A.grad, tf.grad( f )( t( A ) ) ]
        ] );
    }
}

test_matrix_ops();
