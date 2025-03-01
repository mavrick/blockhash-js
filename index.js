// Perceptual image hash calculation tool based on algorithm descibed in
// Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu
//
// Copyright 2014 Commons Machinery http://commonsmachinery.se/
// Distributed under an MIT license, please see LICENSE in the top dir.

const { createCanvas, loadImage } = require('canvas');

const one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/* Calculate the hamming distance for two hashes in hex format */
const hammingDistance = function(hash1, hash2) {
    var d = 0;
    var i;
    for (i = 0; i < hash1.length; i++) {
        var n1 = parseInt(hash1[i], 16);
        var n2 = parseInt(hash2[i], 16);
        d += one_bits[n1 ^ n2];
    }
    return d;
};

const median = function(data) {
    var mdarr = data.slice(0);
    mdarr.sort(function(a, b) { return a-b; });
    if (mdarr.length % 2 === 0) {
        return (mdarr[mdarr.length/2] + mdarr[mdarr.length/2 + 1]) / 2.0;
    }
    return mdarr[Math.floor(mdarr.length/2)];
};

const bits_to_hexhash = function(bitsArray) {
    var hex = [];
    for (var i = 0; i < bitsArray.length; i += 4) {
        var nibble = bitsArray.slice(i, i + 4);
        hex.push(parseInt(nibble.join(''), 2).toString(16));
    }

    return hex.join('');
};

const bmvbhash_even = function(data, bits) {
    var blocksize_x = Math.floor(data.width / bits);
    var blocksize_y = Math.floor(data.height / bits);

    var result = [];

    for (var y = 0; y < bits; y++) {
        for (var x = 0; x < bits; x++) {
            var total = 0;

            for (var iy = 0; iy < blocksize_y; iy++) {
                for (var ix = 0; ix < blocksize_x; ix++) {
                    var cx = x * blocksize_x + ix;
                    var cy = y * blocksize_y + iy;
                    var ii = (cy * data.width + cx) * 4;

                    var alpha = data.data[ii+3];
                    if (alpha === 0) {
                        total += 765;
                    } else {
                        total += data.data[ii] + data.data[ii+1] + data.data[ii+2];
                    }
                }
            }

            result.push(total);
        }
    }

    var m = [];
    for (var i = 0; i < 4; i++) {
        m[i] = median(result.slice(i*bits*bits/4, i*bits*bits/4+bits*bits/4));
    }
    for (var i = 0; i < bits * bits; i++) {
        if (  ((result[i] < m[0]) && (i < bits*bits/4))
            ||((result[i] < m[1]) && (i >= bits*bits/4) && (i < bits*bits/2))
            ||((result[i] < m[2]) && (i >= bits*bits/2) && (i < bits*bits/4+bits*bits/2))
            ||((result[i] < m[3]) && (i >= bits*bits/2+bits*bits/4))
            ) {
           result[i] = 0;
        } else {
           result[i] = 1;
        }
    }

    return bits_to_hexhash(result);
};

const bmvbhash = function(data, bits) {
    var result = [];

    var i, j, x, y;
    var block_width, block_height;
    var weight_top, weight_bottom, weight_left, weight_right;
    var block_top, block_bottom, block_left, block_right;
    var y_mod, y_frac, y_int;
    var x_mod, x_frac, x_int;
    var blocks = [];

    var even_x = data.width % bits === 0;
    var even_y = data.height % bits === 0;

    if (even_x && even_y) {
        return bmvbhash_even(data, bits);
    }

    // initialize blocks array with 0s
    for (i = 0; i < bits; i++) {
        blocks.push([]);
        for (j = 0; j < bits; j++) {
            blocks[i].push(0);
        }
    }

    block_width = data.width / bits;
    block_height = data.height / bits;

    for (y = 0; y < data.height; y++) {
        if (even_y) {
            // don't bother dividing y, if the size evenly divides by bits
            block_top = block_bottom = Math.floor(y / block_height);
            weight_top = 1;
            weight_bottom = 0;
        } else {
            y_mod = (y + 1) % block_height;
            y_frac = y_mod - Math.floor(y_mod);
            y_int = y_mod - y_frac;

            weight_top = (1 - y_frac);
            weight_bottom = (y_frac);

            // y_int will be 0 on bottom/right borders and on block boundaries
            if (y_int > 0 || (y + 1) === data.height) {
                block_top = block_bottom = Math.floor(y / block_height);
            } else {
                block_top = Math.floor(y / block_height);
                block_bottom = Math.ceil(y / block_height);
            }
        }

        for (x = 0; x < data.width; x++) {
            var ii = (y * data.width + x) * 4;

            var avgvalue, alpha = data.data[ii+3];
            if (alpha === 0) {
                avgvalue = 765;
            } else {
                avgvalue = data.data[ii] + data.data[ii+1] + data.data[ii+2];
            }

            if (even_x) {
                block_left = block_right = Math.floor(x / block_width);
                weight_left = 1;
                weight_right = 0;
            } else {
                x_mod = (x + 1) % block_width;
                x_frac = x_mod - Math.floor(x_mod);
                x_int = x_mod - x_frac;

                weight_left = (1 - x_frac);
                weight_right = x_frac;

                // x_int will be 0 on bottom/right borders and on block boundaries
                if (x_int > 0 || (x + 1) === data.width) {
                    block_left = block_right = Math.floor(x / block_width);
                } else {
                    block_left = Math.floor(x / block_width);
                    block_right = Math.ceil(x / block_width);
                }
            }

            // add weighted pixel value to relevant blocks
            blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
            blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
            blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
            blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
        }
    }

    for (i = 0; i < bits; i++) {
        for (j = 0; j < bits; j++) {
            result.push(blocks[i][j]);
        }
    }

    var m = [];
    for (var i = 0; i < 4; i++) {
        m[i] = median(result.slice(i*bits*bits/4, i*bits*bits/4+bits*bits/4));
    }
    for (var i = 0; i < bits * bits; i++) {
        if (  ((result[i] < m[0]) && (i < bits*bits/4))
            ||((result[i] < m[1]) && (i >= bits*bits/4) && (i < bits*bits/2))
            ||((result[i] < m[2]) && (i >= bits*bits/2) && (i < bits*bits/4+bits*bits/2))
            ||((result[i] < m[3]) && (i >= bits*bits/2+bits*bits/4))
            ) {
           result[i] = 0;
        } else {
           result[i] = 1;
        }
    }

    return bits_to_hexhash(result);
};

const blockhashData = function(imgData, bits, method) {
    let hash;

    if (method === 1) {
        hash = bmvbhash_even(imgData, bits);
    }
    else if (method === 2) {
        hash = bmvbhash(imgData, bits);
    }
    else {
        throw new Error("Bad hashing method");
    }

    return hash;
};

const blockhash = (src, bits, method, callback) => {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  loadImage(src).then((img) => {
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    const hash = blockhashData(imgData, bits, method);

    return callback(null, hash);
  }).catch(callback);
};

module.exports = {
  hammingDistance,
  blockhash,
  blockhashData,
}

