safeClick("btnCopiarJSON", () => {
    const raw = localStorage.getItem("panelData");

    if (!raw) {
        alert("⚠️ No hay datos para copiar.");
        return;
    }

    navigator.clipboard
        .writeText(raw)
        .then(() => alert("✅ Respaldo copiado desde almacenamiento interno"))
        .catch(() => alert("❌ No se pudo copiar el respaldo"));
});
