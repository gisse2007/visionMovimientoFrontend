/**
 * main.js — Pantalla principal (index.html)
 * Spec ref: Sección 10 (Pantallas), Sección 7 (Funcionalidades)
 */

const API = "https://visionmovimientobackend.onrender.com";

async function verificarSistema() {
  try {
    const [health, stats] = await Promise.all([
      fetch(`${API}/health`).then(r => r.json()),
      fetch(`${API}/historial/estadisticas`).then(r => r.json()),
    ]);

    // Status badge
    const badge = document.getElementById("statusBadge");
    badge.innerHTML = `<span class="dot dot--on"></span> Conectado`;

    // Info chips
    document.getElementById("infoCamera").textContent =
      health.camara_activa ? "✅ Activa" : "⚠️ Inactiva";

    document.getElementById("infoModelo").textContent =
      health.modelo_cargado ? "✅ Cargado" : "⚠️ Sin modelo";

    const clases = health.clases_disponibles ?? [];
    document.getElementById("infoClases").textContent =
      clases.length > 0 ? clases.join(", ") : "Ninguna";

    document.getElementById("infoRegistros").textContent =
      stats.total ?? 0;

  } catch {
    document.getElementById("statusBadge").innerHTML =
      `<span class="dot dot--warn"></span> Sin conexión con API`;
  }
}

document.getElementById("btnIniciar")?.addEventListener("click", async () => {
  try {
    const r = await fetch(`${API}/camara/iniciar`, { method: "POST" });
    const data = await r.json();
    alert(data.mensaje ?? "Cámara iniciada");
    verificarSistema();
  } catch {
    alert("No se pudo conectar con la API. Asegúrate de que el backend esté corriendo.");
  }
});

verificarSistema();
