// ==UserScript==
// @name         crystalrosegame
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       You
// @match        https://crystalrosegame.wildrift.leagueoflegends.com
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const REMOTE_URL = 'https://github.com/phungtd/crystalrosegame/raw/refs/heads/main/index.js';

    const _Land = {
        State: {
            NONE: 0,
            GROW: 1,
            HARVEST: 2,
            LACKWATER: 3
        },
        GrowthStage: {
            NONE: 0,
            GROWING: 1,
            MATURITY: 2
        }

    };

    GM_xmlhttpRequest({
        method: 'GET',
        url: REMOTE_URL,
        onload: function (response) {
            if (response.status !== 200) {
                console.error('Failed to load remote script');
                return;
            }

            let jscontent = response.responseText;
            jscontent = jscontent.replaceAll('"./', '"./assets/');
            jscontent = jscontent.replaceAll('new URL("', 'new URL("assets/');

            jscontent = jscontent.replaceAll('create(){', 'create(){window.sceneObj=this;');

            const script = document.createElement('script');
            script.type = 'module';
            script.crossOrigin = 'anonymous';
            script.textContent = jscontent;

            // Inject inline
            document.documentElement.appendChild(script);

            console.log('[TM] script injected inline');
        },
        onerror: function () {
            console.error('GM_xmlhttpRequest failed');
        }
    });

    function waitForLoginScene(cb, interval = 1000, timeout = 60000) {
        const start = Date.now();

        const timer = setInterval(() => {

            console.log('[TM] login timer', unsafeWindow.sceneObj);

            if (
                unsafeWindow.sceneObj &&
                unsafeWindow.sceneObj.constructor &&
                unsafeWindow.sceneObj.constructor.name === 'Login'
            ) {
                clearInterval(timer);
                cb(unsafeWindow.sceneObj);
            }

            if (Date.now() - start > timeout) {
                clearInterval(timer);
                console.warn('[TM] login scene timeout');
            }
        }, interval);
    }

    function waitForGameScene(cb, interval = 1000, timeout = 60000) {
        const start = Date.now();

        const timer = setInterval(() => {
            console.log('[TM] game timer', unsafeWindow.sceneObj);
            if (
                unsafeWindow.sceneObj &&
                unsafeWindow.sceneObj.constructor &&
                unsafeWindow.sceneObj.constructor.name === 'Game'
            ) {
                clearInterval(timer);
                cb(unsafeWindow.sceneObj);
            }

            if (Date.now() - start > timeout) {
                clearInterval(timer);
                console.warn('[TM] game scene timeout');
            }
        }, interval);
    }

    waitForLoginScene(async loginScene => {
        console.log('[TM] login scene ready:', loginScene);

        await sleep(3000);

        if (loginScene.game.GameData.loginInfo.isLogin) {

            loginScene.scene.start("Preloader");

            waitForGameScene(async gameScene => {
                console.log('[TM] game scene ready:', gameScene);

                let changed = false;

                const l = gameScene.plantView.landGroup.getChildren();

                for (let i = 0; i < l.length; i++) {
                    const e = l[i];

                    console.log(`[TM] ${i + 1} ${e.curState}`);

                    if (e.curState === _Land.State.NONE) {
                        await gameScene.game.GameApi.exchangeItem(2000005, 1);
                        await gameScene.game.GameApi.plantCrop(i + 1, 2000005);
                        changed = true;
                    }

                    if (e.curState === _Land.State.LACKWATER) {
                        console.log(`[TM] water ${i + 1}`);
                        await gameScene.game.GameApi.waterCrop(i + 1);
                        changed = true;
                    }

                    if (e.curState === _Land.State.HARVEST) {
                        console.log(`[TM] harvest ${i + 1}`);
                        await gameScene.game.GameApi.harvestCrop(i + 1);
                        changed = true;
                    }
                }

                if (changed) {
                    unsafeWindow.location.reload();
                }
            });

        } else {
            alert('Logged out');
        }
    });

    const PANEL_ID = 'tm-crystal-panel';

    async function autoWaterHarvest() {
        console.log('[TM] auto water harvest');

        const l = window.plantView.landGroup.getChildren();

        for (let i = 0; i < l.length; i++) {
            const e = l[i];

            if (e.curState === _Land.State.LACKWATER) {
                console.log(`[TM] water ${i + 1}`);
                window.plantView.landIndex = i + 1;
                window.plantView.water(e);
                await sleep(1000);
            }

            if (e.curState === _Land.State.HARVEST) {
                console.log(`[TM] harvest ${i + 1}`);
                // e.harvest();
                window.plantView.landIndex = i + 1;
                window.plantView.showHarvestPanel(e);
                await sleep(1000);
            }
        }
    }

    function hookReady() {
        if (!window.GameApi || !window.plantView) {
            alert("Hook failed");
            return 0;
        }
        console.log("[TM] hook ready");
        return 1;

    }

    function injectPanel() {
        if (document.getElementById(PANEL_ID)) {
            return;
        }

        const root = document.body || document.documentElement;
        if (!root) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        /* ===== INLINE STYLE ===== */
        panel.style.position = 'fixed';
        panel.style.top = '20px';
        panel.style.left = '20px';
        panel.style.maxWidth = '300px';
        panel.style.background = '#1e1e1e';
        panel.style.color = '#fff';
        panel.style.padding = '10px';
        panel.style.borderRadius = '8px';
        panel.style.fontSize = '11px';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.zIndex = '2147483647';
        panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.6)';

        console.log("[TM] hook ready");

        panel.innerHTML = `
      <div id="tm-drag" style="
         cursor: move;
         font-weight: bold;
         margin-bottom: 6px;
         background: #333;
         padding: 4px 6px;
         border-radius: 4px;
         user-select: none;">
         ☰ Crystal Rose Panel
      </div>
      <div style="font-weight:bold;margin-bottom:6px;">Position</div>
      ${[1, 2, 3, 4, 5, 6].map(v => `
        <label style="">
          <input type="checkbox" checked value="${v}"> ${v}
        </label>
      `).join('')}

      <div style="font-weight:bold;margin:8px 0 4px;">Action</div>
      <label style="">
        <input type="radio" name="action" value="Plant" checked> Plant
      </label>
      <label style="">
        <input type="radio" name="action" value="Water"> Water
      </label>

      <div style="font-weight:bold;margin:8px 0 4px;">Items</div>
      <div style="max-height:180px;overflow:auto;border:1px solid #444;padding:4px;">
        ${[
                [2000001, 'Skyglow Tulip'],
                [2000002, 'Battle Rose'],
                [2000003, 'Spirit Lotus'],
                [2000004, 'Emerald Vine'],
                [2000005, 'Fire Iris'],
                [2000006, 'Desert Rose'],
                [2000007, 'Voidbloom'],
                [2000008, 'Thunder Iris'],
                [2000009, 'Crystal Rose'],
                [20000010, 'Aurora Icebloom'],
                [20000011, 'Moonlight Lotus'],
                [20000012, 'Starlight Lily']
            ].map(([id, name]) => `
          <label style="display:block">
            <input type="radio" name="item" value="${id}"> ${name}
          </label>
        `).join('')}
      </div>

      <button id="tm-auto"
        style="
          width:100%;
          margin-top:8px;
          padding:6px;
          background:#4caf50;
          color:#fff;
          border:none;
          border-radius:4px;
          font-weight:bold;
          cursor:pointer;
        ">
        AUTO
      </button>

      <button id="tm-run"
        style="
          width:100%;
          margin-top:8px;
          padding:6px;
          background:#4caf50;
          color:#fff;
          border:none;
          border-radius:4px;
          font-weight:bold;
          cursor:pointer;
        ">
        RUN
      </button>
    `;

        document.documentElement.appendChild(panel);

        (function enableDrag(el, handle) {
            let isDragging = false;
            let startX = 0, startY = 0;
            let startLeft = 0, startTop = 0;

            handle.addEventListener('mousedown', e => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = el.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                e.preventDefault();
            });

            function onMove(e) {
                if (!isDragging) return;
                el.style.left = startLeft + (e.clientX - startX) + 'px';
                el.style.top = startTop + (e.clientY - startY) + 'px';
                el.style.right = 'auto'; // rất quan trọng
            }

            function onUp() {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
        })(panel, panel.querySelector('#tm-drag'));


        panel.querySelector('#tm-run').onclick = async () => {
            if (!hookReady()) return;

            const positions = [...panel.querySelectorAll('input[type=checkbox]:checked')]
                .map(e => e.value);

            const action = panel.querySelector('input[name=action]:checked')?.value;
            const item = panel.querySelector('input[name=item]:checked')?.value;

            if (!window.GameApi) {
                alert('GameApi not available');
                return;
            }

            if (action === 'Plant') {

                console.log('[TM] plant start', { positions, item });

                for (const position of positions) {
                    try {
                        console.log(`[TM] plant ${position} with ${item}`);
                        await window.GameApi.plantCrop(position, item);
                    } catch (e) {
                        console.error('[TM] plant error', { position, item, e });
                    }
                }

                alert(`[TM] Plant done`);
            }

            if (action === 'Water') {
                console.log('[TM] water start', { positions });
                for (const position of positions) {
                    try {
                        console.log(`[TM] water ${position}`);
                        await window.GameApi.waterCrop(position);
                    } catch (e) {
                        console.error('[TM] Water error', { position, e });
                    }
                }

                alert(`[TM] Water done`);
            }
        };

        panel.querySelector('#tm-auto').onclick = async () => {
            if (!hookReady()) return;
            await autoWaterHarvest();
        }

        console.log('[TM] panel injected');

    }


    // observe TOP
    // const mo = new MutationObserver(() => injectPanel());
    // mo.observe(document.documentElement, {
    //   childList: true,
    //   subtree: true
    // });

    // injectPanel();

})();
