// File: router.js
// Minimal client-side router for the fishbanks SPA shell.
//
// The shell (Fishbanks.html) loads all lib files up-front and contains one
// <template id="tpl-<page>"> per route. goto(page) swaps the template
// content into #app and calls window['init_' + page]() if defined.

var ROUTES = ['teams', 'setup', 'decisions', 'reports', 'graphs', 'about'];
var DEFAULT_ROUTE = 'teams';

var TITLES = {
	teams: '漁人的榮耀 - 開新遊戲',
	setup: '漁人的榮耀 - 起始設定',
	decisions: '漁人的榮耀 - 小組決策',
	reports: '漁人的榮耀 - 報表',
	graphs: '漁人的榮耀 - 圖表分析',
	about: '漁人的榮耀 - 關於'
};

function goto(page, replace) {
	if (ROUTES.indexOf(page) === -1) {
		console.error('[router] unknown page:', page);
		return;
	}
	var url = '?page=' + page;
	// 跨頁切換時保留 display 旗標，這樣使用者中途 F5 也不會掉出投影模式。
	if (document.body.classList && document.body.classList.contains('display-present')) {
		url += '&display=present';
	}
	if (replace) {
		history.replaceState({page: page}, '', url);
	} else {
		history.pushState({page: page}, '', url);
	}
	render(page);
}

function render(page) {
	var tpl = document.getElementById('tpl-' + page);
	var app = document.getElementById('app');
	if (!tpl || !app) {
		console.error('[router] template or #app missing for page:', page);
		return;
	}
	app.innerHTML = '';
	app.appendChild(tpl.content.cloneNode(true));
	document.title = TITLES[page] || '漁人的榮耀';

	var initFn = window['init_' + page];
	if (typeof initFn === 'function') {
		try {
			initFn();
		} catch (err) {
			console.error('[router] init_' + page + ' threw:', err);
		}
	}
}

function getRouteFromURL() {
	var m = location.search.match(/[?&]page=([^&]+)/);
	return m ? decodeURIComponent(m[1]) : DEFAULT_ROUTE;
}

// Deep-link guard：游戲狀態活在 in-memory myStorage + globals。直接 deep-link
// 到 decisions/reports/graphs 而沒走過 teams → setup → startTurn 的人，
// 會看到一整片 NaN/undefined。攔下來、顯示提示、塞個按鈕送回 teams。
// init_* 在判斷狀態未就緒時呼叫此函式，回傳 false 並中止後續渲染。
function requireGameState() {
	if (myStorage.getItem('allData') && typeof ships[1] !== 'undefined') return true;
	document.getElementById('app').innerHTML =
		'<div style="max-width:600px;margin:4em auto;padding:2em;text-align:center;font-family:sans-serif;line-height:1.6">' +
		'<h2>遊戲尚未開始</h2>' +
		'<p>看起來你是從外部連結或書籤直接進到這頁。<br/>' +
		'這份遊戲的狀態存在記憶體中，必須先從「開新遊戲」走起始設定，才能繼續。</p>' +
		'<p><input type="button" value="回到開新遊戲" onclick="goto(\'teams\')" ' +
		'style="padding:0.8em 1.6em;font-size:1.1em;cursor:pointer" /></p>' +
		'</div>';
	return false;
}

window.addEventListener('popstate', function(e) {
	var page = (e.state && e.state.page) || getRouteFromURL();
	render(page);
});

// 投影模式：URL 帶 ?display=present 進入時開啟，加大字級、放大按鈕、壓低 banner，
// 給講師投影機 + 後排看的場合用。狀態 sticky 到 SPA reload；page 切換不會掉。
function applyDisplayMode() {
	var m = location.search.match(/[?&]display=([^&]+)/);
	if (!m) return;
	var mode = decodeURIComponent(m[1]);
	if (mode === 'present') {
		document.body.classList.add('display-present');
	}
}

window.addEventListener('DOMContentLoaded', function() {
	applyDisplayMode();
	var page = getRouteFromURL();
	// Replace state so popstate gets a sensible initial entry。保留 display 旗標。
	var initUrl = '?page=' + page;
	if (document.body.classList && document.body.classList.contains('display-present')) {
		initUrl += '&display=present';
	}
	history.replaceState({page: page}, '', initUrl);
	render(page);
});

// 遊戲狀態只活在記憶體（myStorage 是 in-memory JS 物件，非 localStorage），
// F5 / 關分頁 / 投影機線拔到都會整局失。在遊戲中頁面攔下意外 unload，
// 跳瀏覽器原生「離開此頁面？」提示。in-app goto() 走 pushState 不觸發此事件。
var GUARDED_PAGES = ['reports', 'decisions', 'graphs'];
window.addEventListener('beforeunload', function(e) {
	if (GUARDED_PAGES.indexOf(getRouteFromURL()) === -1) return;
	e.preventDefault();
	e.returnValue = '';
});
