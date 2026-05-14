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

window.addEventListener('popstate', function(e) {
	var page = (e.state && e.state.page) || getRouteFromURL();
	render(page);
});

window.addEventListener('DOMContentLoaded', function() {
	var page = getRouteFromURL();
	// Replace state so popstate gets a sensible initial entry
	history.replaceState({page: page}, '', '?page=' + page);
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
