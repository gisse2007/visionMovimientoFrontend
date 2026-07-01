/**
 * recognition.js — Modo dual: local (stream) y nube (base64)
 */

const API = "http://localhost:8000";
const POLL_MS = 300;

let pollingInterval = null;
let streamInterval = null;
let miniHistoryItems = [];
let modoNube = false;

// Elementos DOM
const videoStream     = document.getElementById("videoStream");
const videoPlaceholder= document.getElementById("videoPlaceholder");
const visibilityBadge = document.getElementById("visibilityBadge");
const visibilityText  = document.getElementById("visibilityText");
const btnIniciarCam   = document.getElementById("btnIniciarCam");
const btnDetenerCam   = document.getElementById("btnDetenerCam");
const btnIniciarRec   = document.getElementById("btnIniciarRec");
const btnDetenerRec   = document.getElementById("btnDetenerRec");
const btnRegistrar    = document.getElementById("btnRegistrar");
const movimientoActual= document.getElementById("movimientoActual");
const confidenceFill  = document.getElementById("confidenceFill");
const confidenceText  = document.getElementById("confidenceText");
const probList        = document.getElementById("probList");
const miniHistory     = document.getElementById("miniHistory");
const statusBadge     = document.getElementById("statusBadge");

// Canvas oculto para capturar frames del video del navegador
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
let videoElement = null; // video real del navegador en modo nube

async function verificarHealth() {
  try {
    const h = await fetch(`${API}/health`).then(r => r.json());
    statusBadge.innerHTML = `<span class="dot dot--on"></span> Conectado`;
    modoNube = h.modo === "nube";

    if (!modoNube && h.camara_activa) mostrarStreamLocal();
    if (h.modelo_cargado) btnIniciarRec.disabled = false;
  } catch {
    statusBadge.innerHTML = `<span class="dot dot--warn"></span> Sin API`;
  }
}

// ---- MODO LOCAL: stream MJPEG desde backend ----
async function iniciarCamaraLocal() {
  try {
    const r = await fetch(`${API}/camara/iniciar`, { method: "POST" });
    const d = await r.json();
    if (d.ok) mostrarStreamLocal();
  } catch { alert("No se pudo conectar con la API."); }
}

function mostrarStreamLocal() {
  videoStream.src = `${API}/video/stream`;
  videoStream.style.display = "block";
  videoPlaceholder.classList.add("hidden");
  btnIniciarRec.disabled = false;
}

// ---- MODO NUBE: cámara del navegador ----
async function iniciarCamaraNube() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.play();

    // Mostrar el video del navegador en el img tag usando canvas
    videoElement.onloadedmetadata = () => {
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Dibujar video en canvas y mostrarlo como imagen
      const renderLoop = () => {
        ctx.drawImage(videoElement, 0, 0);
        videoStream.src = canvas.toDataURL("image/jpeg", 0.8);
        requestAnimationFrame(renderLoop);
      };
      renderLoop();

      videoStream.style.display = "block";
      videoPlaceholder.classList.add("hidden");
      btnIniciarRec.disabled = false;
    };
  } catch {
    alert("No se pudo acceder a la cámara del navegador.");
  }
}

async function iniciarCamara() {
  if (modoNube) {
    await iniciarCamaraNube();
  } else {
    await iniciarCamaraLocal();
  }
}

async function detenerCamara() {
  detenerReconocimiento();
  if (modoNube && videoElement) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
    videoElement = null;
  } else {
    await fetch(`${API}/camara/detener`, { method: "POST" }).catch(() => {});
  }
  videoStream.style.display = "none";
  videoPlaceholder.classList.remove("hidden");
  btnIniciarRec.disabled = true;
}

// ---- Reconocimiento ----
async function iniciarReconocimiento() {
  try {
    const r = await fetch(`${API}/reconocimiento/iniciar`, { method: "POST" });
    const d = await r.json();
    if (!d.ok) { alert(d.detail ?? "Error"); return; }

    btnIniciarRec.disabled = true;
    btnDetenerRec.disabled = false;
    btnRegistrar.disabled = false;

    if (modoNube) {
      // En modo nube enviamos frames al backend
      streamInterval = setInterval(enviarFrame, 200);
    } else {
      // En modo local hacemos polling del resultado
      pollingInterval = setInterval(obtenerResultado, POLL_MS);
    }
  } catch { alert("Error al iniciar reconocimiento."); }
}

async function detenerReconocimiento() {
  clearInterval(pollingInterval);
  clearInterval(streamInterval);
  pollingInterval = null;
  streamInterval = null;
  await fetch(`${API}/reconocimiento/detener`, { method: "POST" }).catch(() => {});
  btnIniciarRec.disabled = false;
  btnDetenerRec.disabled = true;
}

// ---- Enviar frame en modo nube ----
async function enviarFrame() {
  if (!videoElement) return;
  ctx.drawImage(videoElement, 0, 0);
  const frameBase64 = canvas.toDataURL("image/jpeg", 0.7);

  try {
    const r = await fetch(`${API}/frame/clasificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame: frameBase64 }),
    });
    const d = await r.json();
    actualizarUI(d);
  } catch { /* silencioso */ }
}

async function obtenerResultado() {
  try {
    const r = await fetch(`${API}/reconocimiento/resultado`);
    const d = await r.json();
    actualizarUI(d);
  } catch { /* silencioso */ }
}

function actualizarUI(data) {
  const movimiento = data.movimiento_suavizado ?? data.movimiento ?? "—";
  const confianza  = data.confianza ?? 0;
  const visible    = data.usuario_visible ?? false;
  const reconocido = data.reconocido ?? false;

  movimientoActual.textContent = movimiento;
  movimientoActual.style.color = reconocido ? "var(--accent2)" : "var(--text-muted)";
  confidenceFill.style.width   = `${(confianza * 100).toFixed(1)}%`;
  confidenceText.textContent   = `Confianza: ${(confianza * 100).toFixed(1)}%`;

  visibilityText.textContent = visible ? "✅ Visible" : "⚠️ Ajusta posición";
  visibilityBadge.style.borderColor = visible ? "var(--success)" : "var(--warning)";

  const probs = data.todas_probabilidades ?? {};
  if (Object.keys(probs).length > 0) {
    const max = Math.max(...Object.values(probs));
    probList.innerHTML = Object.entries(probs)
      .sort(([,a],[,b]) => b - a)
      .map(([nombre, prob]) => {
        const pct = (prob * 100).toFixed(1);
        const w   = max > 0 ? (prob / max * 100).toFixed(1) : 0;
        return `
          <div class="prob-item">
            <div class="prob-item__header">
              <span>${nombre}</span><span>${pct}%</span>
            </div>
            <div class="prob-item__bar">
              <div class="prob-item__bar-fill" style="width:${w}%"></div>
            </div>
          </div>`;
      }).join("");
  }

  if (reconocido && movimiento !== "Desconocido" && movimiento !== "—") {
    const ultimo = miniHistoryItems[miniHistoryItems.length - 1];
    if (ultimo !== movimiento) {
      miniHistoryItems.push(movimiento);
      if (miniHistoryItems.length > 10) miniHistoryItems.shift();
      miniHistory.innerHTML = [...miniHistoryItems].reverse()
        .map(m => `<li>${m}</li>`).join("");
    }
  }
}

async function registrarMovimiento() {
  try {
    const r = await fetch(`${API}/reconocimiento/registrar`, { method: "POST" });
    const d = await r.json();
    if (d.ok) {
      btnRegistrar.textContent = "✅ Registrado";
      setTimeout(() => { btnRegistrar.textContent = "💾 Registrar en Historial"; }, 1500);
    } else {
      alert(d.detail ?? "Error al registrar");
    }
  } catch { alert("Error de conexión."); }
}

btnIniciarCam?.addEventListener("click", iniciarCamara);
btnDetenerCam?.addEventListener("click", detenerCamara);
btnIniciarRec?.addEventListener("click", iniciarReconocimiento);
btnDetenerRec?.addEventListener("click", detenerReconocimiento);
btnRegistrar ?.addEventListener("click", registrarMovimiento);
document.getElementById("btnActivarCam")?.addEventListener("click", iniciarCamara);

verificarHealth();