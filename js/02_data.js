// 02_data.js

export const importarDesdeJson = (jsonString) => {
    try {
        if (!jsonString || typeof jsonString !== "string") return false;

        const parsed = JSON.parse(jsonString);

        // Validación mínima estructural
        if (typeof parsed !== "object" || Array.isArray(parsed)) return false;

        panelData = {
            ...DEFAULT_PANEL_DATA,
            ...parsed,
            parametros: {
                ...DEFAULT_PANEL_DATA.parametros,
                ...(parsed.parametros || {})
            }
        };

        validarYArreglarDatos();

        // 🔒 PERSISTENCIA REAL
        localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));

        return true;
    } catch (e) {
        console.error("❌ Error importando respaldo:", e);
        return false;
    }
};
