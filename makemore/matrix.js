function zeros( rows, cols ) {
    return Array.from( { length: rows }, () => Array.from( { length: cols }, () => 0 ) );
}

function oneHot( ns, length ) {
    return ns.map( ( n ) => Array.from( { length }, ( _, i ) => n === i ? 1 : 0  ) );
}

function random( rows, cols ) {
    return Array.from( { length: rows }, () => Array.from( { length: cols }, () => randomMinMax( -1, 1 ) ) );
}

function matrixDotProduct( a, b ) {
    const rows = a.length;
    const cols = b[ 0 ].length;
    return Array.from( { length: rows }, ( _, i ) => Array.from( { length: cols }, ( _, j ) => {
        const row = a[ i ];
        const col = b.map( ( r, k ) => r[ j ].mul( row[ k ] ) );
        return col.shift().add( ...col );
    } ) );
}

function matrixExp( a ) {
    return a.map( ( row ) => row.map( ( x ) => x.exp() ) );
}

function sample(probs) {
    const sum = probs.reduce((a, b) => a + b, 0)
    if (sum <= 0) throw Error('probs must sum to a value greater than zero')
    const normalized = probs.map(prob => prob / sum)
    const sample = Math.random()
    let total = 0
    for (let i = 0; i < normalized.length; i++) {
        total += normalized[i]
        if (sample < total) return i
    }
}

fetch('https://raw.githubusercontent.com/karpathy/makemore/master/names.txt')
.then(res => res.text()).then(text => {
    const names = text.split('\n');
    const chars = [ ...new Set( [ ...names.join('') ] ) ].sort();
    const totalChars = chars.length + 1;
    const stringToCharMap = chars.reduce( ( map, char, index ) => {
        map[ char ] = index + 1;
        return map;
    }, {} );
    stringToCharMap[ '.' ] = 0;
    indexToCharMap = [ '.', ...chars ];

    // Inputs.
    const xs = [];
    // Targets, or labels.
    const ys = [];

    for ( const name of names ) {
        const exploded = '.' + name + '.';
        i = 1;
        while ( exploded[ i ] ) {
            const bigram = exploded[i - 1] + exploded[i];
            const indexOfChar1 = stringToCharMap[ exploded[ i - 1 ] ];
            const indexOfChar2 = stringToCharMap[ exploded[ i ] ];
            xs.push( indexOfChar1 );
            ys.push( indexOfChar2 );
            i++;
        }
    }

    const W = new Matrix( nj.random( 27, 27 ) );
    const enc = nj.array( oneHot( xs, totalChars ) );
    const xenc = new Matrix( enc );
    const logits = xenc.matMul( W ); // log counts
    // Softmax.
    const counts = logits.exp();
    const probs = counts.div( counts.sum( 1 ) ); // normalized probabilities
    const relevantProbs = probs.gather( ys );
    const loss = relevantProbs.log().mean().mul( nj.array( -1 ) ).add( W.pow( 2 ).mean().mul( nj.array( 0.01 ) ) );
    const iterations = 3;

    drawDot( loss )

    let lastLoss = Infinity;

    function run() {
        for (let i = 0; i < iterations; i++) {
            loss.forward();

            const lossValue = loss.data.tolist()[0];
            const action = lossValue < lastLoss ? 'log' : 'error';

            console[action](`Loss after iteration ${i}: ${lossValue}`);

            lastLoss = loss.data.tolist()[0];

            loss.backward();

            W.data = W.data.assign( W.data.subtract( W.grad.multiply( 1 ) ) );
        }

        for (let i = 0; i < 5; i++) {
            const out = []  
            let ix = 0;

            while ( true ) {
                const xenc = new Matrix( nj.array( oneHot( [ ix ], totalChars ) ) );
                const logits = xenc.matMul( W );
                const counts = logits.exp();
                const probs = counts.div( counts.sum( 1 ) );
                probs.forward();
                // console.log( probs.data.tolist()[ 0 ] );
                ix = sample( probs.data.tolist()[ 0 ] );

                // console.log( indexToCharMap[ ix ] );

                out.push( indexToCharMap[ ix ] );

                if ( ix === 0 ) {
                    break;
                }
            }

            console.log( out.join( '' ) );
        }
    }

    const button = document.createElement( 'button' );
    button.textContent = 'Run';
    button.onclick = run;

    document.body.appendChild( button );
});