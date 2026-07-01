/**
 * results.js — Pantalla de resultados (results.html)
 * Spec ref: Sección 7 (Historial), Sección 12 (Persistencia local)
 */

const API = "https://visionmovimientobackend.onrender.com";

async function cargarEstadisticas() {
  try {
    const stats = await fetch(`${API}/historial/estadisticas`).then(r => r.json());

    document.getElementById("statTotal").textContent      = stats.total ?? 0;
    document.getElementById("statReconocidos").textContent = stats.reconocidos ?? 0;
    document.getElementById("statConfianza").textContent  =
      stats.confianza_promedio != null
        ? `${(stats.confianza_promedio * 100).toFixed(1)}%`
        : "—";
    document.getElementById("statFrecuente").textContent  =
      stats.movimiento_mas_frecuente ?? "—";

    // Distribución por movimiento
    const movimientos = stats.movimientos ?? {};
    const total = stats.total || 1;
    const dist = document.getElementById("movDistribution");

    if (Object.keys(movimientos).length === 0) {
      dist.innerHTML = `<p class="muted">Sin datos aún</p>`;
    } else {
      const max = Math.max(...Object.values(movimientos));
      dist.innerHTML = Object.entries(movimientos)
        .sort(([,a],[,b]) => b - a)
        .map(([nombre, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          const w   = ((count / max) * 100).toFixed(1);
          return `
            <div class="mov-bar">
              <div class="mov-bar__header">
                <span>${nombre}</span>
                <span>${count} (${pct}%)</span>
              </div>
              <div class="mov-bar__track">
                <div class="mov-bar__fill" style="width:${w}%"></div>
              </div>
            </div>`;
        }).join("");
    }

  } catch {
    console.warn("No se pudo conectar con la API para estadísticas.");
  }
}

async function cargarHistorial() {
  try {
    const data = await fetch(`${API}/historial?ultimos=100`).then(r => r.json());
    const body = document.getElementById("historyBody");

    if (!data.registros || data.registros.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="muted center">Sin registros</td></tr>`;
      return;
    }

    body.innerHTML = [...data.registros].reverse().map(r => {
      const fecha = new Date(r.timestamp).toLocaleString("es-CO");
      const badge = r.reconocido
        ? `<span class="badge badge--ok">✓ Reconocido</span>`
        : `<span class="badge badge--fail">✗ No reconocido</span>`;
      const conf  = r.reconocido ? `${(r.confianza * 100).toFixed(1)}%` : "—";
      return `
        <tr>
          <td>${r.id}</td>
          <td>${fecha}</td>
          <td><strong>${r.movimiento}</strong></td>
          <td>${conf}</td>
          <td>${badge}</td>
        </tr>`;
    }).join("");

  } catch {
    console.warn("No se pudo cargar el historial.");
  }
}

async function limpiarHistorial() {
  if (!confirm("¿Estás seguro? Se eliminarán todos los registros del historial.")) return;
  try {
    await fetch(`${API}/historial/limpiar`, { method: "DELETE" });
    await cargarEstadisticas();
    await cargarHistorial();
  } catch {
    alert("Error al limpiar el historial.");
  }
}

document.getElementById("btnLimpiar")?.addEventListener("click", limpiarHistorial);

// Iniciar carga
cargarEstadisticas();
cargarHistorial();
