// ==UserScript==
// @name         crystalrosegame
// @namespace    http://tampermonkey.net/
// @version      1.1.2
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

    const REMOTE_URL = 'https://cdn.jsdelivr.net/gh/phungtd/crystalrosegame@main/index.js';

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

                unsafeWindow.location.reload();
            }
        }, interval);
    }

    function setStatus(message) {
        let bar = document.getElementById("tm-status-bar");

        if (!bar) {
            bar = document.createElement("div");
            bar.id = "tm-status-bar";

            Object.assign(bar.style, {
                position: "fixed",
                bottom: "0",
                left: "0",
                width: "100%",
                zIndex: 999999,
                background: "rgba(0,0,0,0.9)",
                color: "#fff",
                fontSize: "13px",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
                padding: "6px 10px",
                boxShadow: "0 -2px 8px rgba(0,0,0,.3)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
            });

            document.body.appendChild(bar);
        }

        const time = new Date().toLocaleTimeString();
        bar.textContent = `[${time}] ${message}`;
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

                unsafeWindow.location.reload();
            }
        }, interval);
    }

    waitForLoginScene(async loginScene => {
        console.log('[TM] login scene ready:', loginScene);
        setStatus('Login scene ready');

        await sleep(5000);

        if (loginScene.game.GameData.loginInfo.isLogin) {

            loginScene.scene.start("Preloader");
            setStatus('Preloader');

            waitForGameScene(async gameScene => {
                console.log('[TM] game scene ready:', gameScene);
                setStatus('Game scene ready');

                const autorun2 = async () => {
                    try {
                        const autoPlant = localStorage.getItem("auto_Plant") === "true";
                        const autoWater = localStorage.getItem("auto_Water") === "true";
                        const autoHarvest = localStorage.getItem("auto_Harvest") === "true";
                        const autoBuy = localStorage.getItem("auto_Buy") === "true";

                        const hasItem = function (id) {
                            return gameScene.game.GameData.infoData.bag.seeds.some(i => i.iItemId === Number(id));
                        };

                        if (!gameScene.game.GameApi.serverUnixTime) {
                            await gameScene.game.GameApi.getServerTime();
                            console.log('[TM] server time', gameScene.game.GameApi.serverUnixTime);
                            setStatus(`Server time ${gameScene.game.GameApi.serverUnixTime}`);
                        }

                        const garden = await gameScene.game.GameApi.getUserGardenInfo();
                        const { gardenInfo: n = [] } = garden.jData;
                        console.log('[TM] garden', garden);

                        for (const e of n) {
                            const { cropId: h, wateringTime: d, plantTime: c, cropDetail: u, landIndex: p } = e;

                            const autoCell = localStorage.getItem(`auto_${p}`) === "true";
                            const autoItem = localStorage.getItem(`item_${p}`);
                            if (!autoCell || !autoItem) return;

                            if (h === 0) {
                                if (autoPlant) {
                                    if (hasItem(autoItem)) {
                                        console.log(`[TM] plant ${p}`);
                                        setStatus(`Plant ${p}`);
                                        await gameScene.game.GameApi.plantCrop(p, autoItem);
                                    } else {
                                        console.log(`[TM] unavailable ${autoItem}`, gameScene.game.GameData.infoData.bag.seeds);
                                        if (autoBuy) {
                                            console.log(`[TM] buy ${autoItem}`);
                                            setStatus(`Buy ${autoItem}`);
                                            await gameScene.game.GameApi.exchangeItem(autoItem, 1)
                                            if (hasItem(autoItem)) {
                                                console.log(`[TM] plant ${p}`);
                                                setStatus(`Plant ${p}`);
                                                await gameScene.game.GameApi.plantCrop(p, autoItem);
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (autoHarvest && gameScene.game.GameApi.serverUnixTime - c > u.growTime) {
                                    console.log('[TM] harvest', p);
                                    setStatus(`Harvest ${p}`);
                                    await gameScene.game.GameApi.harvestCrop(p);
                                } else {
                                    if (autoWater && gameScene.game.GameApi.serverUnixTime - d > gameScene.game.GameData.gameConfig.farmEnterWaterDeficitCountdown) {
                                        console.log('[TM] water', p);
                                        setStatus(`Water ${p}`);
                                        await gameScene.game.GameApi.waterCrop(p);
                                    }
                                }
                            }
                        }

                    } catch (e) {
                        console.log('[TM] error', e);
                        // unsafeWindow.location.reload();
                    }
                };

                setInterval(autorun2, 60000);

                await sleep(5000);

                autorun2();

                return;

                let running = false;

                const autorun = async () => {
                    console.log("[TM] auto run");
                    if (running) return;
                    running = true;

                    try {
                        let changed = false;

                        const autoPlant = localStorage.getItem("auto_Plant") === "true";
                        const autoWater = localStorage.getItem("auto_Water") === "true";
                        const autoHarvest = localStorage.getItem("auto_Harvest") === "true";
                        const autoBuy = localStorage.getItem("auto_Buy") === "true";

                        console.log("[TM] ", { autoPlant, autoWater, autoHarvest, autoBuy });

                        const hasItem = function (id) {
                            return gameScene.game.GameData.infoData.bag.seeds.some(i => i.iItemId === Number(id));
                        };

                        const l = gameScene.plantView.landGroup.getChildren();

                        for (let i = 0; i < l.length; i++) {
                            const e = l[i];

                            const autoCell = localStorage.getItem(`auto_${i + 1}`) === "true";
                            const autoItem = localStorage.getItem(`item_${i + 1}`);
                            if (!autoCell || !autoItem) continue;

                            console.log(`[TM] ${i + 1} ${autoItem} ${e.curState} ${e.curGrowthStage}`);

                            if (autoPlant && e.curState === _Land.State.NONE && e.curGrowthStage === _Land.GrowthStage.NONE) {
                                if (hasItem(autoItem)) {
                                    console.log(`[TM] plant ${i + 1}`);
                                    await gameScene.game.GameApi.plantCrop(i + 1, autoItem);
                                    changed = true;
                                } else {
                                    console.log(`[TM] unavailable ${autoItem}`, gameScene.game.GameData.infoData.bag.seeds);
                                    if (autoBuy) {
                                        console.log(`[TM] buy ${autoItem}`);
                                        await gameScene.game.GameApi.exchangeItem(autoItem, 1);
                                        if (hasItem(autoItem)) {
                                            console.log(`[TM] plant ${i + 1}`);

                                            await gameScene.game.GameApi.plantCrop(i + 1, autoItem);
                                            changed = true;
                                        }
                                    }
                                }
                            }

                            if (autoWater && e.curState === _Land.State.LACKWATER) {
                                console.log(`[TM] water ${i + 1}`);
                                await gameScene.game.GameApi.waterCrop(i + 1);
                                changed = true;
                            }

                            if (autoHarvest && e.curState === _Land.State.HARVEST) {
                                console.log(`[TM] harvest ${i + 1}`);
                                await gameScene.game.GameApi.harvestCrop(i + 1);
                                changed = true;

                                if (autoPlant) {
                                    if (hasItem(autoItem)) {
                                        console.log(`[TM] plant ${i + 1}`);
                                        await gameScene.game.GameApi.plantCrop(i + 1, autoItem);
                                    } else {
                                        console.log(`[TM] unavailable ${autoItem}`, gameScene.game.GameData.infoData.bag.seeds);
                                        if (autoBuy) {
                                            console.log(`[TM] buy ${autoItem}`);
                                            await gameScene.game.GameApi.exchangeItem(autoItem, 1);

                                            if (hasItem(autoItem)) {
                                                console.log(`[TM] plant ${i + 1}`);
                                                await gameScene.game.GameApi.plantCrop(i + 1, autoItem);
                                            }
                                        }
                                    }
                                }

                            }
                        }

                        if (changed) {
                            unsafeWindow.location.reload();
                        } else {
                            console.log("[TM] nothing to do");
                        }
                    } catch (err) {
                        console.error('[TM] autorun error', err);
                        unsafeWindow.location.reload();
                    } finally {
                        running = false;
                    }
                };

                setInterval(autorun, 60000);

                await sleep(5000);

                autorun();

            });

        } else {
            unsafeWindow.location.reload();
        }
    });

    // setTimeout(unsafeWindow.location.reload, 300000);

    const PANEL_ID = 'tm-crystal-panel';

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
         display:flex;
         align-items: center;
         justify-content: space-between;
         user-select: none;">
         ☰ Crystal Rose Panel
         <div style="margin-left:16px">
             <button id="tm-min">_</button>
             <button id="tm-max">□</button>
         </div>
      </div>

      <div id="tm-content" style="display:none">

      <div style="font-weight:bold;margin:16px 0 8px;">AUTO</div>
      ${['Plant', 'Water', 'Harvest', 'Buy'].map(v => `
        <label style="">
          <input type="checkbox" name="auto_${v}" value="on"> ${v}
        </label>
      `).join('')}

      <div style="font-weight:bold;margin:16px 0 8px;">ITEMS</div>
      ${[1, 2, 3, 4, 5, 6].map(v => `
      <div style="display:flex;margin-bottom:8px;flex-direction:row;">
        <label style="">
          <input type="checkbox" name="auto_${v}" value="${v}"> ${v} &nbsp;
        </label>
        <select name="item_${v}" style="flex:1;">
          <option value="0">---</option>
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
                [2000010, 'Aurora Icebloom'],
                [2000011, 'Moonlight Lotus'],
                [2000012, 'Starlight Lily']
            ].map(([id, name]) => `
            <option value="${id}">${name}</option>
          `).join('')}
        </select>
        </div>
      `).join('')}

      <button id="tm-save"
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
          display:none;
        ">
        SAVE
      </button>
    </div>
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

        panel.querySelectorAll('[name]').forEach(el => {
            const saved = localStorage.getItem(el.name);

            if (saved === null) return;

            if (el.type === "checkbox") {
                el.checked = saved === "true";
            } else {
                el.value = saved;
            }
        });

        panel.addEventListener("change", (e) => {
            const el = e.target;

            if (!el.name) return;

            if (el.type === "checkbox") {
                localStorage.setItem(el.name, el.checked);
            } else {
                localStorage.setItem(el.name, el.value);
            }
        })


        panel.querySelector('#tm-min').onclick = async () => {
            panel.querySelector('#tm-content').style.display = 'none';
        };


        panel.querySelector('#tm-max').onclick = async () => {
            panel.querySelector('#tm-content').style.display = 'block';
        };

        console.log('[TM] panel injected');

    }


    // observe TOP
    // const mo = new MutationObserver(() => injectPanel());
    // mo.observe(document.documentElement, {
    //   childList: true,
    //   subtree: true
    // });

    injectPanel();

})();