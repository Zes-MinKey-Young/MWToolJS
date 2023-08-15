// @ts-check
"use strict";

(function WWJS($, mw, zui) {


if (
	window.frameElement != null
	&& window.frameElement.tagName.toUpperCase() == "IFRAME"
) {
	return;
}
const api = new mw.Api();
const minorDefault = mw.user.options.get("minordefault") === "1";
const watchDefault = mw.user.options.get("watchdefault") === 1;
class WikiWindow {
	/**
	 * @param {string} href
	 * @param {WikiWindows} windows 
	 */
	constructor(href, windows) {
		var _href, url, deferred;
		var windowTypes = ["edit", "view", "diff"];


		deferred = $.Deferred();
		this.promise = deferred.promise();
		this.windows = windows;
		this.loadUI();
		for (let windowType of windowTypes) {
			if (href.startsWith("/" + windowType)) {
				try {
					var params = JSON.parse(href.slice(5));
					return this[windowType](JSON.parse(href), deferred);
				} catch (e) {
					throw Error("JSON解析错误");
				}
			}
		}
		var base = mw.config.get("wgServer");
		if (href.startsWith("/wiki/")) {
			_href = base + href;
		} else if (href.startsWith("#")) {
			throw new Error("不应当这样打开窗口");
		} else if (href.startsWith("/w")) {
			_href = base + href;
		} else {
			_href = base + "/wiki/" + href;
		}
		url = new URL(_href);
		if (url.searchParams.get("diff")) {
			return this.diff(url, deferred);
		}
		switch (url.searchParams.get("action")) {
			case "edit":
				return this.edit(url, deferred);
			case "history":
				return this.history(url, deferred);
			case "move":
				return this.move(url, deferred)
			default:
				return this.view(url, deferred);
		}
	}
	/**
	 * @param {JQuery<HTMLElement> | HTMLElement} link
	 * @param {WikiWindows} windows
	 */
	static fromLink(link, windows) {
		let href = $(link).attr("href")
		if (href) {
			return new WikiWindow(href, windows)
		}
	}
	/**
	 * 
	 */
	loadUI() {
		this.$element = $("<div/>")
			.addClass("wikiwindow")
			.appendTo(this.windows.$element)
			.hide();
		this.$topBar = $("<div/>")
			.addClass("wikiwindow-bar")
			.appendTo(this.$element);
		this.$hideBtn = $("<a/>")
			.addClass("wikiwindow-hide")
			.appendTo(this.$topBar);
		this.$title = $("<div/>")
			.addClass("wikiwindow-title")
			.appendTo(this.$topBar);
		this.$doneBtn = $("<a/>")
			.addClass("wikiwindow-done")
			.appendTo(this.$topBar);
		this.$container = $("<div/>")
			.addClass("wikiwindow-container")
			.appendTo(this.$element);
	}
	/**
	 * @param {URL} url
	 */
	static getTitle(url) {
		var title;
		if (url.pathname.startsWith("/w/")) {
			title = url.searchParams.get("title");
		} else if (url.pathname.startsWith("/wiki/")) {
			title = url.pathname.slice(6);
		} else {
			throw new Error("非法参数");
		}
		if (!title) {
			throw new Error("无标题")
		}
		if (title.startsWith("Special:")) {
			throw new Error("不可编辑特殊页面");
		}
		return decodeURI(title);
	}
	/**
	 * @param {JQuery<HTMLElement>} $interface
	 */
	static fixInterfaceAnchors($interface) {
		/**
		 * @type {JQuery.PlainObject<HTMLElement>}
		 */
		var anchors = {};
		$interface.find("*[id]").each(function (_, element) {
			anchors[this.id] = element;
		});
		$interface.on("click", "a", function (e) {
			var ele = e.currentTarget;
			var $ele = $(ele);
			if (!$ele.attr("href").startsWith("#")) {
				return;
			}
			e.preventDefault();
			var id = $ele.attr("href").slice(1);
			if (id in anchors) {
				var anchor = anchors[id];
				if ($(anchor).is(":visible")) {
					anchor.scrollIntoView();
				}
			}
		});
	}
	/**
	 * @param {string} title
	 * @param {JQuery.Deferred} deferred
	 * @param {Array<any>} p
	 */
	accomplish(title, deferred, p) {
		this.state = "ready";
		deferred.resolveWith(this, p);
		this.$element.fadeIn();
		this.title = title;
		this.windows.empty = false;
		if (title.length <= 15) {
			this.$title.attr("title", title).html(title);
		} else {
			this.$title.attr("title", title).html(title.slice(0, 13) + "...");
		}
	}
	/**
	 * @param {URL} url
	 * @param {JQuery.Deferred<any, any, any>} deferred
	 */
	view(url, deferred) {
		this.type = "view";
		var href = url.href;
		this.iframe = document.createElement("iframe")
		this.$iframe = $(this.iframe)
			.appendTo(this.$container);
		this.$iframe.attr({
			width: "100%",
			height: "100%",
			src: href,
			scrolling: "yes"
		});
		this.$iframe.on("load", (ev) => {
			var title = ev.currentTarget.contentDocument.getElementsByTagName("title")[0].innerHTML;
			this.accomplish(title, deferred, []);
		});
		return this;
	}
	/**
	 * @param {URL | JQuery.PlainObject} url
	 * @param {JQuery.Deferred<any, any, any>} deferred
	 */
	edit(url, deferred) {
		/* Window (URL url, jQuery.Deferred deferred)*/
		this.type = "edit";
		var title;
		if (url instanceof URL) {
			title = WikiWindow.getTitle(url);
		} else {
			title = url.title;
		}

		api.get({
			"action": "query",
			"format": "json",
			"prop": "info|revisions",
			"formatversion": "2",
			"titles": title,
			"inprop": "protection",
			"rvprop": "ids|timestamp|flags|comment|user|content|contentmodel",
			"rvslots": "main"
		}).done(result => {
			console.log(result);
			var page = result.query.pages[0];
			let content;
			if (page.missing) {
				content = "<!-- Not Exists-->"
			} else {
				let revision, revid;
				if (revid = url.searchParams.get("revid")) {
					for (let each of page.revisions) {
						if (each.revid == revid) {
							revision = each;
							break;
						}
					}
				} else {
					revision = page.revisions[0]
				}
				content = revision.slots.main.content
			}
			var protection;
			if (page.protection.length) {
				for (let each of page.protection) {
					if (each.type === "edit") {
						protection = each.level;
					}
				}
			}
			if (protection) {
				if (protection === "autocomfirmed") {
					if (!mw.config.get("wgUserGroups").includes("autocomfirmed")) {
						mw.notify("你没有权限编辑该页面。");
						this.close();
						return;
					}
				}
			}
			var $interface = WikiWindows.Interface();
			var $content = $("<div/>").appendTo($interface);
			var $textarea = $("<textarea/>").css("height", "40em");
			this.$textarea = $textarea;
			var button = new zui.Button({
				text: "提交"
			});
			var checkbox1 = new zui.Checkbox({
				"default": minorDefault
			});
			var checkbox2 = new zui.Checkbox({
				"default": watchDefault
			});
			var input = new zui.Input({
				"default": "Edit via WikiWindows"
			});
			var layout1 = new zui.Layout([
				checkbox1, "标记为小编辑",
				checkbox2, "监视本页"
			]);
			var layout2 = new zui.Layout([
				"摘要：", input
			]);
			button.click(() => {
				api.postWithEditToken({
					action: "edit",
					format: "json",
					title: title,
					formatversion: "2",
					text: $textarea.val(),
					summary: input.val(),
					minor: checkbox1.val(),
					watch: checkbox2.val()
				}).done(res => {
					console.log(res);
					mw.notify("成功！");
					this.windows.close(this.windows.shownWindows.indexOf(this));
				});
			});
			this.$container.append($interface);
			$content.append($textarea)
				.append(layout1.$element)
				.append(layout2.$element)
				.append(button.$element);
			$textarea.val(content);
			this.accomplish("编辑" + title, deferred, [result]);
		});
		return this;
	}
	/**
	 * @param {URL} url
	 * @param {JQuery.Deferred<any, any, any>} deferred
	 */
	diff(url, deferred) {
		var fromrev, torev;
		if (url instanceof URL) {
			fromrev = url.searchParams.get("oldid");
			torev = url.searchParams.get("diff");
		}
		api.get({
			action: "compare",
			fromrev: fromrev,
			torev: torev,
			format: "json",
			formatversion: "2"
		}).done((result) => {
			var $interface = WikiWindows.Interface();
			var $content = $("<div/>").appendTo($interface);
			var $diff = $("<table/>").appendTo($content);
			var $body = $("<tbody/>").appendTo($diff);
			$diff.css("width", "100%");
			$body.addClass("diff diff-contentalign-left"
				+ "diff-editfont-monospace");
			$interface.appendTo(this.$container);
			$body.html(result.compare.body);
			api.get({
				action: "parse",
				format: "json",
				oldid: torev,
				formatversion: "2"
			}).done((result) => {
				var $title = $("<h1/>");
				$title.html(result.parse.displaytitle + "（版本" + torev + "）");
				$content.append($title)
					.append(result.parse.text);
				WikiWindow.fixInterfaceAnchors($interface);
			});
			this.accomplish("比较" + fromrev + "与" + torev + "的差异", deferred, [result]);
		});
		return this;
	}
	/**
	 * @param {URL} url
	 * @param {JQuery.Deferred<any, any, any>} deferred
	 */
	history(url, deferred) {
		this.state = "history";
		var title = WikiWindow.getTitle(url);
		api.get({
			"action": "query",
			"format": "json",
			"prop": "revisions",
			"titles": title,
			"formatversion": "2",
			"rvprop": "ids|timestamp|flags|comment|user|size",
			"rvlimit": "500"
		}).done((result) => {
			/**
			 * @type {Array}
			 */
			var revisions = result.query.pages[0].revisions;
			var $interface = WikiWindows.Interface().appendTo(this.$container);
			var $table = $("<table/>").appendTo($interface).addClass("wikiwindow-history-table");
			var $tbody = $("<tbody/>").appendTo($table);
			var span = new zui.Span();
			/**
			 * 鬼知道我以前为什么发电想到拿函数来弄的
			 *  type {(($e: JQuery) => JQuery)[]}
			var lists = [];
			 */
			var deltas = [];
			for (let stringIndex in revisions) {
				let index = parseInt(stringIndex)
				let revision = revisions[index]
				deltas.push(revision.size - (revisions[index + 1] ? revisions[index + 1].size : 0))
			}
			var lgDeltas = [];
			for (let item of deltas) {
				lgDeltas.push(Math.log10(Math.abs(item)))
			}
			// 最大的变化量，以它为参照
			var standardDelta = Math.max.apply(Math, lgDeltas);

			for (let stringIndex in revisions) {
				let index = parseInt(stringIndex)
				let revision = revisions[index]

				/*
				 * @param {JQuery<HTMLElement>} $e
				 *
				function add($e) {
					var $td;
					$row.append($td = $("<td>").append($e));
					return $td;
				}
				*/
				let $row = $("<tr/>").appendTo($tbody);
				let $revLink = $("<a/>");
				let $usrLink = $("<a/>");
				let date = new Date(revision.timestamp);
				$revLink.html(date.toLocaleString());
				$revLink.attr("href", encodeURI(`/w/index.php?title=${title}&oldid=${revision.revid}`));
				$usrLink.html(revision.user);
				$usrLink.attr("href", revision.anon ? `/wiki/Special:Contributions/${revision.user}` : `/wiki/User:${revision.user}`);
				let $delta = $("<span/>");
				let delta = deltas[index]
				let lgDelta = lgDeltas[index]
				if (delta > 0) {
					$delta.html("+" + delta);
					$delta.css("color", "green");
				} else if (delta === 0) {
					$delta.html("0");
					$delta.css("color", "grey");
				} else {
					$delta.html(delta + "");
					$delta.css("color", "red");
				}
				let $rect = $("<div/>")
					.addClass("wikiwindow-history-delta-rect")
					.attr("title", `${delta} bytes (10^${("" + lgDelta.toString()).slice(0, -5)})`);
				let width = 40 * (lgDelta / standardDelta) + "%";
				$rect.css("width", width);
				if (delta > 0) {
					$rect.addClass("wikiwindow-history-delta-rect-positive");
				} else {
					$rect.addClass("wikiwindow-history-delta-rect-negative");
				}
				$row.append(
					$("<td/>").append(span.newPlace(revision.revid)),
					$("<td/>").append($revLink),
					$("<td/>").append($usrLink),
					$("<td/>").append($delta)
					          .addClass("wikiwindows-history-delta"),
					$("<td/>").append(
						$("<span/>")
							.css("fontWeight", "bold")
							.html(revision.minor ? "小" : "")
						),
					$("<td/>").append(
						$("<span/>")
							.css("color", "grey")
							.html(revision.comment)
						)
						.addClass("comment"),
					$rect
				);
				deltas.push(delta);
			}


			var button = new zui.Button({
				text: "比较"
			});
			button.click(function () {
				var [oldid, diff] = span.val();
				this.windows.open(`/w/index.php?title=${title}&oldid=${oldid}&diff=${diff}`);
			});
			button.$element.prependTo($interface);
			this.accomplish("查看历史：" + title, deferred, [revisions]);
		});
		return this;
	}
	/**
	 * @param {URL} url
	 * @param {JQuery.Deferred<any, any, any>} deferred
	 */
	move(url, deferred) {
		this.state = "move"
		var title = WikiWindow.getTitle(url)
		var $interface = WikiWindows.Interface().appendTo(this.$container);
		var $content = $("<div/>").appendTo($interface);
		var input = new zui.Input({"default": title})
		var reasonInput = new zui.Input({"default": "Move via WikiWindows"})
		var checkboxNoredirect = new zui.Checkbox({"default": false})
		var checkboxMovetalk = new zui.Checkbox({"default": true})
		var checkboxMovesub = new zui.Checkbox({"default": true})
		var button = new zui.Button({text: "移动"})
		var layout1 = new zui.Layout(["目标：", input, button])
		var layout2 = new zui.Layout(["原因：", reasonInput])
		var layout3 = new zui.Layout([
			checkboxNoredirect,"不要创建重定向",
			checkboxMovetalk, "移动讨论页",
			checkboxMovesub, "移动子页面",
		])
		layout1.$element.appendTo($content)
		layout2.$element.appendTo($content)
		layout3.$element.appendTo($content)
		this.accomplish("重命名" + title, deferred, [])
		button.click(() => {
			console.log({
				action: "move",
				from: title,
				to: input.val(),
				reason: reasonInput.val(),
				movetalk: checkboxMovetalk.val(),
				movesubpages: checkboxMovesub.val(),
				noredirect: checkboxNoredirect.val(),
				format: "json"
			})
			api.postWithToken("csrf", {
				action: "move",
				from: title,
				to: input.val(),
				reason: reasonInput.val(),
				movetalk: checkboxMovetalk.val(),
				movesubpages: checkboxMovesub.val(),
				noredirect: checkboxNoredirect.val(),
				format: "json",
				ignorewarnings: true
			}).done((res) => {
				console.log("Move:", res)
				if (res.result === "Success") {
					mw.notify("成功")
					this.close()
				} else {
					mw.notify("哦豁")
				}
			}).fail((res) => {
				console.log(res);
			})
		})
		return this;
	}
	setOnclick(/* void */) { // => void
		// 给顶部按钮设定点击事件句柄。
		this.$title.on("click", () => {
			this.raise();
		});
		this.$hideBtn.on("click", () => {
			this.hide()
		});
		this.$doneBtn.on("click", () => {
			this.close()
		});
	}
	passOnclick() {
		// 如果有iframe，传递onclick。
		if (!this.is("view")) return;
		this.ready(() => {
			var windows = this.windows;
			this.$(document).on("click", "a", (/** @type {Event} */ e) => windows.handleLink(e));
		});
	}
	makeHidden() {
		// 最小化到底部。
		var windows = this.windows, $hidden = this.$hidden = $("<div/>");
		$hidden.addClass("wikiwindow-hidden")
			.html(this.title)
			.appendTo(windows.$hidden);
		$hidden.on("click", () => {
			$hidden.remove();
			windows.show(this.index);
		});
	}
	get $() { // Window.$ => JQueryStatic|void
		// iframe中的jQuery，如果有。
		if (!this.is("view")) return undefined;
		// @ts-ignore
		return this.$iframe[0].contentWindow.jQuery;
	}
	get index() { // Window.index => Number
		// 自己在Wikiwindows中的下标。
		var wd = this.windows;
		return wd.shownWindows.indexOf(this) >= 0 ? wd.shownWindows.indexOf(this) : wd.hidden.indexOf(this);
	}
	/**
	 * @param {JQuery.Deferred.CallbackBase<any, any, any, any>} callback
	 */
	ready(callback) {
		// 准备好时运行回调函数。
		if (this.state == "ready") {
			return void (callback());
		}
		this.promise.done(callback);
	}
	/**
	 * @param {string} type
	 */
	is(type) {
		return this.type === type;
	}
	close() {
		this.windows.close(this.index)
	}
	raise() {
		this.windows.raise(this.index)
	}
	hide() {
		this.windows.hide(this.index)
	}
}
class WikiWindows {
	constructor() {
		/**
		 * @type {WikiWindow[]}
		 */
		this.shownWindows = [];
		/**
		 * @type {WikiWindow[]}
		 */
		this.hidden = [];
		this.state = 0;
		this._empty = true
		this.init();
	}
	get empty() {
		return this._empty
	}
	set empty(val) {
		if (val != this._empty) {
			this._empty = val
			if (val) {
				this.$element.addClass("wikiwindows-empty")
			} else {
				this.$element.removeClass("wikiwindows-empty")
			}
		}
	}
	init() {
		var $body = $("body");
		this.$open = $("<div/>")
			.addClass("wikiwindows-open")
			.html("O")
			.appendTo($body);
		this.$element = $("<div/>").addClass("wikiwindows").addClass("wikiwindows-empty").appendTo($body);
		this.$open.on("click", () => this.handleOpen());
		this.setClick();
		this.$hidden = $("<div/>").addClass("wikiwindows-hidden").insertAfter(this.$open);
		return this;
	}
	handleOpen() {
		switch (this.state) {
			case WikiWindows.NORMAL:
				this.select();
				break;
			case WikiWindows.SELECT:
				this.input();
				break;
			case WikiWindows.INPUT:
				this.selectInput();
				break;
			case WikiWindows.SELECT_INPUT:
				this.home();
		}
	}
	/**
	 * @param {Event} event
	 */
	handleLink(event) {
		// console.log(event, this);
		var target = event.currentTarget;
		if (this.state === WikiWindows.SELECT && target instanceof HTMLElement) {
			if (!this.open(target)) {
				return
			}
			this.home();
			event.preventDefault();
		}
	}
	handleGo() {
		let win = this.open(this.inputBox.val())
		if (win) {
			win.ready(function () {
				var windows = this.windows;
				windows.home();
			});
		}
	}
	setClick() {
		$(document).on("click", "a", event => {
			var target = event.currentTarget;
			if (this.state === WikiWindows.SELECT) {
				if (!this.open(target)) {
					return
				}
				this.home();
				event.preventDefault();
			} else if (this.state === WikiWindows.SELECT_INPUT) {
				this.inputBox.val(WikiWindow.getTitle(new URL(target.href)))
				event.preventDefault();
			}
		});
	}
	select() {
		this.$open.addClass("wikiwindows-select");
		this.state = WikiWindows.SELECT;
	}
	selectInput() {
		this.$open.removeClass("wikiwindows-inputing")
			.addClass("wikiwindows-select")
		this.state = WikiWindows.SELECT_INPUT;

	}
	input() {
		this.$open.removeClass("wikiwindows-select")
			.addClass("wikiwindows-inputing");
		this.state = WikiWindows.INPUT;
		var $content = $("body");
		var input = new zui.Input({
			width: "20em"
		});
		var go = new zui.Button({
			text: "Go"
		});
		var edit = new zui.Button({
			text: "Edit"
		});
		this.inputBox = input;
		go.click((/** @type {Event} */ ev) => {
			let win = this.open(this.inputBox.val())
			if (!win) { return }
			win.ready(() => {
				this.home();
			});
		});
		edit.click(() => input.val(input.val() + "?action=edit"));
		var layout = new zui.Layout(["前往：", input, go, edit]);
		this.layout = layout;
		layout.$element.appendTo($content);
		layout.$element.addClass("wikiwindows-input-layout")
	}
	home() {
		if (this.state === WikiWindows.INPUT || this.state === WikiWindows.SELECT_INPUT) {
			this.layout.$element.remove();
			this.layout = null;
		}
		this.$open.removeClass(["wikiwindows-select", "wikiwindows-inputing"])
		this.state = WikiWindows.NORMAL;
	}
	/**
	 * @param {string | HTMLElement | JQuery<HTMLElement>} $link 一个字符串或者（Jquery）元素指示地址
	 * @returns {undefined|WikiWindow}
	 */
	open($link) {
		var win
		if (typeof $link !== "string") {
			win = WikiWindow.fromLink($link, this)
		} else {
			win = new WikiWindow($link, this)
		}
		if (!win) {
			return
		}
		this.shownWindows.push(win);
		win.setOnclick();
		this.reorder();
		return win;
	}
	reorder() {
		var i, len = this.shownWindows.length;
		if (len === 0) {
			this.empty = true;
		}
		for (i = 0; i < len; i++) {
			this.shownWindows[i].$element
				.css("z-index", 1001 + 10 * i)
				.animate({ "top": i * 3 + "em" });
		}
	}
	/**
	 * put the window with the index to the top.
	 * @param {number} index
	 */
	raise(index) {
		var win = this.shownWindows.splice(index, 1)[0];
		this.shownWindows.push(win);
		this.reorder();
	}
	/**
	 * @param {number} index
	 */
	hide(index) {
		var win = this.shownWindows.splice(index, 1)[0];
		win.$element.hide();
		win.makeHidden();
		this.hidden.push(win);
		this.reorder();
	}
	/**
	 * @param {number} index
	 */
	show(index) {
		var win = this.hidden.splice(index, 1)[0];
		win.$element.show();
		this.shownWindows.push(win);
		this.reorder();
	}
	/**
	 * @param {number} index
	 */
	close(index) {
		this.shownWindows.splice(index, 1)[0].$element.remove();
		this.reorder()
	}
	/**
	 * @param {{ x: any; y: any; }} pos
	 * @param {number} radius
	 */
	Circle(pos, radius) {
		this.pos = pos;
		this.radius = radius || 40;
		var r = this.radius, d = r * 2;
		this.$element = $("<div/>")
			.addClass("wikiwindows-circle-wrapper")
			.css({
				height: d,
				width: d,
				position: "absolute",
				top: pos.x,
				left: pos.y
			});
		this.$left = $("<div/>")
			.addClass("wikiwindows-half-wrapper")
			.css("left", 0)
			.appendTo(this.$element);
		this.$right = $("<div/>")
			.addClass("wikiwindows-half-wrapper")
			.css("right", 0)
			.appendTo(this.$element);
	}
	static Interface() {
		return $("<div/>").addClass("wikiwindow-interface");
	}
	showLoader() {
		if (!window.scriptLoader) {
			return;
		}
		var obj = {};
		this.$element.addClass("wikiwindows-empty")
		WikiWindow.prototype.loadUI.call(obj, this.$element);
		obj.$done.on("click", () => { obj.$element.remove(); this.reorder() });
		var $interface = WikiWindows.Interface();
		$interface.appendTo(obj.$container);
		var $ul = $("<ul/>").appendTo($interface);
		for (let name in scriptLoader.registry) {
			let project = scriptLoader.registry[name]
			let $li = $("<li/>").appendTo($ul);
			$li.append(name).append("&nbsp;(").append(project.name).append(")&nbsp;");
			$li.append("：").append(project.description);
			if ("dependencies" in project) {
				$li.append("<br>");
				$li.append("依赖于：").append(project.dependencies.join(",&nbsp;"));
			}
			$li.append("<br>");
			$li.append("开始于：").append(project.timing.load + "");
			$li.append("结束于：").append(project.timing.ready + "");
			$li.append("用时：").append(Math.round(project.timing.ready - project.timing.load) / 1000 + "");
		}
		obj.$element.show();
	}
}
WikiWindows.NORMAL = 0
WikiWindows.SELECT = 1
WikiWindows.INPUT = 2
WikiWindows.SELECT_INPUT = 3
if (window.scriptLoader) {
	var windows = new WikiWindows();
	// @ts-ignore
	window.windows = windows;
	var li = mw.util.addPortletLink("p-views", "", "加载器", "scriptloader-show");
	$(li).find("a").on("click", () => windows.showLoader());
	window.scriptLoader.send("wikiwindows", 1);
} else {
	var windows = new WikiWindows();
	// @ts-ignore
	window.windows = windows;
}





})(jQuery, mw, window.z ? z.ui : zui);
