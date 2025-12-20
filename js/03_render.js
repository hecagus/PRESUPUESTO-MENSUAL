// 03_render.js
import { $, fmtMoney } from "./01_consts_utils.js";
import { getState, getWalletData } from "./02_data.js";

export const renderDashboard = () => {
    const el = $("balance");
    if (!el) return;

    const wallet = getWalletData();
    el.textContent = `$${fmtMoney(wallet.totales.disponible)}`;
};

export const renderWallet = () => {
    const cont = $("walletContainer");
    if (!cont) return;

    const { sobres } = getWalletData();
    cont.innerHTML = "";

    sobres.forEach(s => {
        const div = document.createElement("div");
        div.textContent = `${s.nombre}: $${fmtMoney(s.acumulado)}`;
        cont.appendChild(div);
    });
};
