// VerifyCheck — accès caméra + décodage QR.
//
// Objectif connectivité faible (Conakry) : ne télécharger la librairie QR
// (vendor/html5-qrcode.min.js, ≈ 360 Ko) QUE si le navigateur n'offre pas le
// décodage natif. Deux moteurs, choisis à l'exécution :
//   1. NATIF  — BarcodeDetector (Chrome/Android récents) : AUCUN script à
//      télécharger, démarrage quasi instantané même en 2G/3G ;
//   2. REPLI  — html5-qrcode, chargé À LA DEMANDE (script async) uniquement
//      quand le natif est absent ou a échoué.
//
// L'UI ne dépend que de cette façade (start/stop/listCameras/torch), donc le
// moteur peut évoluer sans toucher au reste de l'application.

window.VC = window.VC || {};

VC.qr = (function () {
  const READER_ID = "reader";
  const VENDOR = "vendor/html5-qrcode.min.js";
  // ~6-7 détections/seconde : largement suffisant pour un QR présenté à la
  // caméra, et bien plus économe en CPU/batterie qu'une boucle vidéo.
  const DETECT_INTERVAL_MS = 150;

  let backend = null; // "native" | "lib" | null
  let running = false;
  let currentDeviceId = null;

  // --- moteur natif (BarcodeDetector) ---
  let nativeStream = null;
  let nativeVideo = null;
  let nativeDetector = null;
  let nativeTimer = null;

  // --- moteur de repli (html5-qrcode) ---
  let libScanner = null;
  let vendorPromise = null;

  const readerEl = () => document.getElementById(READER_ID);

  const hasSupport = () =>
    !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  function hasNative() {
    return typeof window.BarcodeDetector === "function" && hasSupport();
  }

  /** Le décodage natif gère-t-il vraiment le QR sur cet appareil ? */
  async function nativeSupportsQr() {
    if (!hasNative()) return false;
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      return Array.isArray(formats) && formats.indexOf("qr_code") !== -1;
    } catch {
      return false;
    }
  }

  /** Charge la librairie de repli une seule fois, et seulement si nécessaire. */
  function loadVendor() {
    if (typeof window.Html5Qrcode !== "undefined") return Promise.resolve();
    if (!vendorPromise) {
      vendorPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = VENDOR;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          vendorPromise = null; // on pourra réessayer
          reject(new Error("Librairie QR indisponible (téléchargement échoué)"));
        };
        document.head.appendChild(script);
      });
    }
    return vendorPromise;
  }

  function source(deviceId) {
    return deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" };
  }

  // ------------------------------------------------------------- moteur natif
  async function startNative({ deviceId, onCode }) {
    const container = readerEl();
    if (!container) throw new Error("Conteneur caméra introuvable");

    nativeStream = await navigator.mediaDevices.getUserMedia({
      video: Object.assign(
        { width: { ideal: 1280 }, height: { ideal: 720 } },
        source(deviceId)
      ),
      audio: false,
    });

    nativeVideo = document.createElement("video");
    nativeVideo.setAttribute("playsinline", "");
    nativeVideo.setAttribute("muted", "");
    nativeVideo.autoplay = true;
    nativeVideo.muted = true;
    nativeVideo.srcObject = nativeStream;
    container.replaceChildren(nativeVideo);
    await nativeVideo.play().catch(() => {});

    nativeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });

    const tick = async () => {
      if (!running || !nativeVideo || !nativeDetector) return;
      try {
        const codes = await nativeDetector.detect(nativeVideo);
        if (codes && codes.length && codes[0].rawValue) onCode && onCode(codes[0].rawValue);
      } catch {
        /* image pas encore prête / non décodable : on ignore cette frame */
      }
    };
    nativeTimer = setInterval(tick, DETECT_INTERVAL_MS);

    backend = "native";
    currentDeviceId = deviceId;
  }

  async function stopNative() {
    if (nativeTimer) {
      clearInterval(nativeTimer);
      nativeTimer = null;
    }
    if (nativeVideo) {
      try {
        nativeVideo.pause();
      } catch {
        /* déjà arrêtée */
      }
      nativeVideo.srcObject = null;
      nativeVideo = null;
    }
    if (nativeStream) {
      nativeStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* rien à faire */
        }
      });
      nativeStream = null;
    }
    nativeDetector = null;
    const container = readerEl();
    if (container) container.replaceChildren();
  }

  // ---------------------------------------------------------- moteur de repli
  async function startLib({ deviceId, onCode }) {
    await loadVendor();
    if (typeof window.Html5Qrcode === "undefined") {
      throw new Error("Librairie QR indisponible");
    }
    libScanner = new window.Html5Qrcode(READER_ID, { verbose: false });
    await libScanner.start(
      source(deviceId),
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0, disableFlip: false },
      (text) => onCode && onCode(text),
      () => {
        /* pas de QR dans cette frame : normal, on ignore */
      }
    );
    backend = "lib";
    currentDeviceId = deviceId;
  }

  async function stopLib() {
    if (libScanner) {
      try {
        await libScanner.stop();
      } catch {
        /* déjà arrêté */
      }
      try {
        libScanner.clear();
      } catch {
        /* rien à nettoyer */
      }
      libScanner = null;
    }
  }

  // ------------------------------------------------------------------ façade
  async function start({ deviceId = null, onCode } = {}) {
    await stop();
    if (!hasSupport()) throw new Error("Caméra indisponible");

    if (await nativeSupportsQr()) {
      try {
        await startNative({ deviceId, onCode });
        running = true;
        return true;
      } catch {
        // Permission, matériel ou détection native en échec → repli librairie.
        await stopNative();
      }
    }

    await startLib({ deviceId, onCode });
    running = true;
    return true;
  }

  async function stop() {
    if (backend === "native") await stopNative();
    else if (backend === "lib") await stopLib();
    backend = null;
    running = false;
    return true;
  }

  async function listCameras() {
    // enumerateDevices couvre les deux moteurs et n'exige pas la librairie.
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ id: d.deviceId, label: d.label || "Caméra " + (i + 1) }));
        if (cams.length) return cams;
      } catch {
        /* repli sur la librairie ci-dessous */
      }
    }
    if (typeof window.Html5Qrcode !== "undefined") {
      try {
        return await window.Html5Qrcode.getCameras();
      } catch {
        /* aucune caméra listable */
      }
    }
    return [];
  }

  function videoTrack() {
    if (nativeStream) return nativeStream.getVideoTracks()[0] || null;
    const video = document.querySelector("#" + READER_ID + " video");
    const stream = video && video.srcObject;
    return stream && stream.getVideoTracks ? stream.getVideoTracks()[0] || null : null;
  }

  /** Torche : API Track Constraints, support variable selon l'appareil. */
  async function setTorch(on) {
    const track = videoTrack();
    if (!track || !track.getCapabilities) return false;
    const caps = track.getCapabilities();
    if (!caps.torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }

  function hasTorch() {
    const track = videoTrack();
    return Boolean(track && track.getCapabilities && track.getCapabilities().torch);
  }

  return {
    hasSupport,
    hasLib: () => typeof window.Html5Qrcode !== "undefined",
    getBackend: () => backend,
    start,
    stop,
    listCameras,
    setTorch,
    hasTorch,
    getDeviceId: () => currentDeviceId,
    isRunning: () => running,
  };
})();
