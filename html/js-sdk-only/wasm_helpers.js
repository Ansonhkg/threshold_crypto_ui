// threshold_crypto wasm calls. Since they operate on single bytes at a time
// it's handy to have helpers to do the required looping.

let isWasming = false;
export const wasmBlsSdkHelpers = new (function () {
  // s is secret key unit8array
  this.sk_bytes_to_pk_bytes = function (s) {
    isWasming = true;
    const pkBytes = [];
    try {
      // set sk bytes
      for (let i = 0; i < s.length; i++) {
        window.wasmExports.set_sk_byte(i, s[i]);
      }
      // convert into pk bytes
      window.wasmExports.derive_pk_from_sk();
      // read pk bytes
      for (let i = 0; i < pkLen; i++) {
        const pkByte = window.wasmExports.get_pk_byte(i);
        pkBytes.push(pkByte);
      }
    } catch (e) {
      isWasming = false;
      throw "Failed to generate";
    }
    isWasming = false;
    return pkBytes;
  };

  // s is secret key uint8array
  // m is message uint8array
  this.sign_msg = function (s, m) {
    isWasming = true;
    const sigBytes = [];
    try {
      // set secret key bytes
      for (let i = 0; i < s.length; i++) {
        window.wasmExports.set_sk_byte(i, s[i]);
      }
      // set message bytes
      for (let i = 0; i < m.length; i++) {
        window.wasmExports.set_msg_byte(i, m[i]);
      }
      // sign message
      window.wasmExports.sign_msg(m.length);
      // get signature bytes
      for (let i = 0; i < sigLen; i++) {
        const sigByte = window.wasmExports.get_sig_byte(i);
        sigBytes.push(sigByte);
      }
    } catch (e) {
      isWasming = false;
    }
    isWasming = false;
    return Uint8Array.from(sigBytes);
  };

  // p is public key uint8array
  // s is signature uint8array
  // m is message uint8array
  this.verify = function (p, s, m) {
    isWasming = true;
    let verified = false;
    try {
      // set public key bytes
      for (let i = 0; i < p.length; i++) {
        window.wasmExports.set_pk_byte(i, p[i]);
      }
      // set signature bytes
      for (let i = 0; i < s.length; i++) {
        window.wasmExports.set_sig_byte(i, s[i]);
      }
      // set message bytes
      for (let i = 0; i < m.length; i++) {
        window.wasmExports.set_msg_byte(i, m[i]);
      }
      verified = window.wasmExports.verify(m.length);
    } catch (e) {
      console.log("error verifying sig:");
      console.log(e);
      isWasming = false;
    }
    isWasming = false;
    return verified;
  };

  this.set_rng_values = function () {
    // Warning if no window.crypto available
    if (!window.crypto) {
      alert(
        "Secure randomness not available in this browser, output is insecure."
      );
      return;
    }
    const RNG_VALUES_SIZE = window.wasmExports.get_rng_values_size();
    const rngValues = new Uint32Array(RNG_VALUES_SIZE);
    window.crypto.getRandomValues(rngValues);
    for (let i = 0; i < rngValues.length; i++) {
      window.wasmExports.set_rng_value(i, rngValues[i]);
    }
  };

  // p is public key uint8array
  // m is message uint8array
  this.encrypt = function (p, m) {
    isWasming = true;
    const ctBytes = [];
    try {
      wasmBlsSdkHelpers.set_rng_values();
      // set public key bytes
      for (let i = 0; i < p.length; i++) {
        window.wasmExports.set_pk_byte(i, p[i]);
      }
      // set message bytes
      for (let i = 0; i < m.length; i++) {
        window.wasmExports.set_msg_byte(i, m[i]);
      }
      // generate strong random u64 used by encrypt
      // encrypt the message
      const ctSize = window.wasmExports.encrypt(m.length);
      // get ciphertext bytes
      for (let i = 0; i < ctSize; i++) {
        const ctByte = window.wasmExports.get_ct_byte(i);
        ctBytes.push(ctByte);
      }
    } catch (e) {
      isWasming = false;
    }
    isWasming = false;
    return Uint8Array.from(ctBytes);
  };

  // s is secret key uint8array
  // c is message uint8array
  this.decrypt = function (s, c) {
    isWasming = true;
    const msgBytes = [];
    try {
      // set secret key bytes
      for (let i = 0; i < s.length; i++) {
        window.wasmExports.set_sk_byte(i, s[i]);
      }
      // set ciphertext bytes
      for (let i = 0; i < c.length; i++) {
        window.wasmExports.set_ct_byte(i, c[i]);
      }
      const msgSize = window.wasmExports.decrypt(c.length);
      // get message bytes
      for (let i = 0; i < msgSize; i++) {
        const msgByte = window.wasmExports.get_msg_byte(i);
        msgBytes.push(msgByte);
      }
    } catch (e) {
      isWasming = false;
    }
    isWasming = false;
    return Uint8Array.from(msgBytes);
  };

  this.generate_poly = function (threshold) {
    wasmBlsSdkHelpers.set_rng_values();
    const polySize = poly_sizes_by_threshold[threshold];
    window.wasmExports.generate_poly(threshold);
    const polyBytes = [];
    for (let i = 0; i < polySize; i++) {
      const polyByte = window.wasmExports.get_poly_byte(i);
      polyBytes.push(polyByte);
    }
    return polyBytes;
  };

  this.get_msk_bytes = function () {
    const mskBytes = [];
    for (let i = 0; i < skLen; i++) {
      const mskByte = window.wasmExports.get_msk_byte(i);
      mskBytes.push(mskByte);
    }
    return mskBytes;
  };

  this.get_mpk_bytes = function () {
    const mpkBytes = [];
    for (let i = 0; i < pkLen; i++) {
      const mpkByte = window.wasmExports.get_mpk_byte(i);
      mpkBytes.push(mpkByte);
    }
    return mpkBytes;
  };

  this.get_mc_bytes = function (threshold) {
    const mcBytes = [];
    const mcSize = commitment_sizes_by_threshold[threshold];
    for (let i = 0; i < mcSize; i++) {
      const mcByte = window.wasmExports.get_mc_byte(i);
      mcBytes.push(mcByte);
    }
    return mcBytes;
  };

  this.set_mc_bytes = function (mcBytes) {
    // set master commitment in wasm
    for (let i = 0; i < mcBytes.length; i++) {
      const v = mcBytes[i];
      window.wasmExports.set_mc_byte(i, v);
    }
  };

  this.get_skshare = function () {
    const skshareBytes = [];
    for (let i = 0; i < skLen; i++) {
      const skshareByte = window.wasmExports.get_skshare_byte(i);
      skshareBytes.push(skshareByte);
    }
    return skshareBytes;
  };

  this.get_pkshare = function () {
    const pkshareBytes = [];
    for (let i = 0; i < pkLen; i++) {
      const pkshareByte = window.wasmExports.get_pkshare_byte(i);
      pkshareBytes.push(pkshareByte);
    }
    return pkshareBytes;
  };

  this.combine_signatures = function (mcBytes, sigshares) {
    // set master commitment in wasm
    wasmBlsSdkHelpers.set_mc_bytes(mcBytes);
    // set the signature shares
    for (let shareIndex = 0; shareIndex < sigshares.length; shareIndex++) {
      const share = sigshares[shareIndex];
      const sigHex = share.shareHex;
      const sigBytes = hexToUint8Array(sigHex);
      const sigIndex = share.shareIndex;
      for (let byteIndex = 0; byteIndex < sigBytes.length; byteIndex++) {
        const sigByte = sigBytes[byteIndex];
        // NB shareIndex is used instead of sigIndex so we can interate
        // over both
        // SHARE_INDEXES[i]
        // and
        // SIGNATURE_SHARE_BYTES[i*96:(i+1)*96]
        window.wasmExports.set_signature_share_byte(
          byteIndex,
          shareIndex,
          sigByte
        );
        window.wasmExports.set_share_indexes(shareIndex, sigIndex);
      }
    }
    // combine the signatures
    window.wasmExports.combine_signature_shares(
      sigshares.length,
      mcBytes.length
    );
    // read the combined signature
    const sigBytes = [];
    for (let i = 0; i < sigLen; i++) {
      const sigByte = window.wasmExports.get_sig_byte(i);
      sigBytes.push(sigByte);
    }
    return Uint8Array.from(sigBytes);
  };

  // s is secret key share bytes
  // ct is ciphertext bytes
  // uiShareIndex is the index of the share as it appears in the UI
  // derivedShareIndex is the index of the share when derived from the poly
  this.create_decryption_share = function (
    s,
    uiShareIndex,
    derivedShareIndex,
    ct
  ) {
    // set ct bytes
    for (let i = 0; i < ct.length; i++) {
      window.wasmExports.set_ct_byte(i, ct[i]);
    }
    // set secret key share
    for (let i = 0; i < s.length; i++) {
      window.wasmExports.set_sk_byte(i, s[i]);
    }
    // create decryption share
    const dshareSize = window.wasmExports.create_decryption_share(
      uiShareIndex,
      ct.length
    );
    // set derivedShareIndex
    window.wasmExports.set_share_indexes(uiShareIndex, derivedShareIndex);
    // read decryption share
    const dshareBytes = [];
    for (let i = 0; i < decryptionShareLen; i++) {
      const dshareByte = window.wasmExports.get_decryption_shares_byte(
        i,
        uiShareIndex
      );
      dshareBytes.push(dshareByte);
    }
    return Uint8Array.from(dshareBytes);
  };

  // Assumes master commitment is already set.
  // Assumes create_decryption_share is already called for all shares,
  // Which means ciphertext is already set
  // and decryption shares are already set
  // and share_indexes is already set
  this.combine_decryption_shares = function (totalShares, mcSize, ctSize) {
    // combine decryption shares
    const msgSize = window.wasmExports.combine_decryption_shares(
      totalShares,
      mcSize,
      ctSize
    );
    // read msg
    const msgBytes = [];
    for (let i = 0; i < msgSize; i++) {
      const msgByte = window.wasmExports.get_msg_byte(i);
      msgBytes.push(msgByte);
    }
    return Uint8Array.from(msgBytes);
  };
})();
