"use strict";

(function WWJS($, mw, zui) {
	if (window.frameElement != null &&
		(window.frameElement.tagName == "IFRAME" || window.frameElement.tagName == "iframe")
	) {
		return;
	}
	var api = new mw.Api();
	var minorDefault = mw.user.options.get("minordefault") === "1";
	var watchDefault = mw.user.options.get("watchdefault") === 1;
	class Window {
		/**
		 * @param {HTMLElement|JQuery<HTMLElement>|string} link
		 * @param {JQuery<HTMLElement>} $content
		 * @param {WikiWindows} windows
		 */
		constructor(link, $content, windows) {
			var href, page, _href, url, deferred;
			var /* function */ resize;
			if (typeof link == "string") {
				href = link;
			} else {
				href = $(link).attr("href");
			}
			if (!href) {
				throw new Error("不是链接");
			}
			var windowTypes = ["edit", "view", "diff"];


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
			deferred = $.Deferred();
			this.promise = deferred.promise();
			this.windows = windows;
			this.$content = $content;
			this.loadUI($content);
			if (url.searchParams.get("diff")) {
				return this.diff(url, deferred);
			}
			switch (url.searchParams.get("action")) {
				case "edit":
					return this.edit(url, deferred);
				case "history":
					return this.history(url, deferred);
				default:
					return this.view(url, deferred);
			}
		}
		/**
		 * @param {JQuery<HTMLElement>} $content
		 */
		loadUI($content) {
			var resize;
			this.$element = $("<div/>")
				.addClass("wikiwindow")
				.appendTo($content)
				.hide();
			this.$bar = $("<div/>")
				.addClass("wikiwindow-bar")
				.appendTo(this.$element);
			this.$hide = $("<a/>")
				.addClass("wikiwindow-hide")
				.appendTo(this.$bar);
			this.$title = $("<div/>")
				.addClass("wikiwindow-title")
				.appendTo(this.$bar);
			this.$done = $("<a/>")
				.addClass("wikiwindow-done")
				.appendTo(this.$bar);
			this.$container = $("<div/>")
				.addClass("wikiwindow-container")
				.appendTo(this.$element);
			var $ele = this.$element;
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
				throw Error("非法参数");
			}
			if (title.startsWith("Special:")) {
				throw Error("不可编辑特殊页面");
			}
			return decodeURI(title);
		}
		/**
		 * @param {JQuery<HTMLElement>} $interface
		 */
		static fixInterfaceAnchors($interface) {
			var anchors = {};
			$interface.find("*[id]").each(function () {
				anchors[this.id] = this;
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
		ok(title, deferred, p) {
			this.state = "ready";
			deferred.resolveWith(this, p);
			this.$element.fadeIn();
			this.title = title;
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
			/* Window (URL url, jQuery.Deferred deferred)*/
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
			var that = this;
			this.$iframe.on("load", function frameOnload() {
				var title = this.contentDocument.getElementsByTagName("title")[0].innerHTML;
				that.ok(title, deferred, []);
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
				title = Window.getTitle(url);
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
				var revision;
				if (!page.missing) {
					revision = page.revisions[0];
				}
				var protection;
				if (page.protection.length) {
					$.each(page.protection, function (_, each) {
						if (each.type === "edit") {
							protection = each.level;
						}
					});
				}
				if (protection) {
					if (protection === "autocomfirmed") {
						if (!mw.config.get("wgUserGroups").includes("autocomfirmed")) {
							mw.notify("你没有权限编辑该页面。");
							this.windows.close(this.index);
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
						mw.notify("成功！");
						this.windows.close(this.windows.windows.indexOf(this));
					});
				});
				this.$container.append($interface);
				$content.append($textarea)
					.append(layout1.$element)
					.append(layout2.$element)
					.append(button.$element);
				$textarea.val(revision ? revision.slots.main.content : "<!-- Not Exists -->");
				this.ok("编辑" + title, deferred, [result]);
			});
			return this;
		}
		/**
		 * @param {URL} url
		 * @param {JQuery.Deferred<any, any, any>} deferred
		 */
		diff(url, deferred) {
			var that = this;
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
			}).done(function (result) {
				var $interface = WikiWindows.Interface();
				var $content = $("<div/>").appendTo($interface);
				var $diff = $("<table/>").appendTo($content);
				var $body = $("<tbody/>").appendTo($diff);
				$diff.css("width", "100%");
				$body.addClass("diff diff-contentalign-left"
					+ "diff-editfont-monospace");
				$interface.appendTo(that.$container);
				$body.html(result.compare.body);
				api.get({
					action: "parse",
					format: "json",
					oldid: torev,
					formatversion: "2"
				}).done(function (result) {
					var $title = $("<h1/>");
					$title.html(result.parse.displaytitle + "（版本" + torev + "）");
					$content.append($title)
						.append(result.parse.text);
					Window.fixInterfaceAnchors($interface);
				});
				that.ok("比较" + fromrev + "与" + torev + "的差异", deferred, [result]);
			});
			return this;
		}
		/**
		 * @param {URL} url
		 * @param {JQuery.Deferred<any, any, any>} deferred
		 */
		history(url, deferred) {
			this.state = "history";
			var title = Window.getTitle(url);
			var that = this;
			api.get({
				"action": "query",
				"format": "json",
				"prop": "revisions",
				"titles": title,
				"formatversion": "2",
				"rvprop": "ids|timestamp|flags|comment|user|size",
				"rvlimit": "500"
			}).done(function (result) {
				/**
				 * @type {Array}
				 */
				var revisions = result.query.pages[0].revisions;
				var $interface = WikiWindows.Interface().appendTo(that.$container);
				var $table = $("<table/>").appendTo($interface).addClass("wikiwindow-history-table");
				var $tbody = $("<tbody/>").appendTo($table);
				var span = new zui.Span();
				var lists = [];
				var deltas = [];
				$.each(revisions, function (i, revision) {
					/**
					 * @param {JQuery<HTMLElement>} $e
					 */
					function add($e) {
						var $td;
						$row.append($td = $("<td>").html($e));
						return $td;
					}
					var $row = $("<tr/>").appendTo($tbody);
					var $link1 = $("<a/>");
					var $link2 = $("<a/>");
					var date = new Date(revision.timestamp);
					$link1.html(date.toLocaleString());
					$link1.attr("href", encodeURI(`/w/index.php?title=${title}&oldid=${revision.revid}`));
					$link2.html(revision.user);
					$link2.attr("href", revision.anon ? `/wiki/Special:Contributions/${revision.user}` : `/wiki/User:${revision.user}`);
					add(span.newPlace(revision.revid));
					add($link1);
					add($link2);
					var $delta = $("<span/>");
					var delta = revision.size - (revisions[i + 1] ? revisions[i + 1].size : 0);
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
					add($delta);
					add($("<span/>").css("fontWeight", "bold").html(revision.minor ? "小" : ""));
					add($("<span/>").css("color", "grey").html(revision.comment)).addClass("comment");
					lists.push(add);
					deltas.push(delta);
				});
				var absDeltas = [];
				$.each(deltas, (_, item) => absDeltas.push(Math.abs(item)));
				var standardDelta = Math.max.apply(Math, absDeltas);
				$.each(deltas, function (i, delta) {
					if (delta === 0) {
						return true;
					}
					var rowAdd = lists[i];
					var $rect = $("<div/>").addClass("wikiwindow-history-delta-rect");
					var width = 40 * (Math.abs(delta) / standardDelta) + "%";
					$rect.css("width", width);
					if (delta > 0) {
						$rect.addClass("wikiwindow-history-delta-rect-positive");
					} else {
						$rect.addClass("wikiwindow-history-delta-rect-negative");
					}
					rowAdd($rect);
				});


				var button = new zui.Button({
					text: "比较"
				});
				button.click(function () {
					var [oldid, diff] = span.val();
					that.windows.open(`/w/index.php?title=${title}&oldid=${oldid}&diff=${diff}`);
				});
				button.$element.prependTo($interface);
				that.ok("查看历史：" + title, deferred, [revisions]);
			});
			return this;
		}
		setOnclick(/* void */) { // => void
			// 给顶部按钮设定点击事件句柄。
			var windows = this.windows;
			this.$title.on("click", () => {
				windows.raise(this.index);
			});
			this.$hide.on("click", () => {
				windows.hide(this.index);
			});
			this.$done.on("click", () => {
				windows.close(this.index);
			});
		}
		passOnclick() {
			// 如果有iframe，传递onclick。
			if (!this.is("view")) return;
			this.ready(() => {
				var windows = this.windows;
				this.$(document).on("click", "a", windows.handlers.link);
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
			return this.$iframe[0].contentWindow.jQuery;
		}
		get index() { // Window.index => Number
			// 自己在Wikiwindows中的下标。
			var wd = this.windows;
			return wd.windows.indexOf(this) >= 0 ? wd.windows.indexOf(this) : wd.hidden.indexOf(this);
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
	}
	class WikiWindows {
		constructor() {
			/**
			 * @type {Window[]}
			 */
			this.windows = [];
			/**
			 * @type {Window[]}
			 */
			this.hidden = [];
			this.state = 0;
			this.handlers = WikiWindows.getHandlers(this);
			this.init();
		}
		init() {
			var $body = $("body");
			var that = this;
			this.$open = $("<div/>")
				.addClass("wikiwindows-open")
				.html("O")
				.appendTo($body);
			this.$element = $("<div/>").addClass("wikiwindows").addClass("wikiwindows-empty").appendTo($body);
			this.$open.on("click", this.handlers.open);
			this.setClick();
			this.$hidden = $("<div/>").addClass("wikiwindows-hidden").insertAfter(this.$open);
			return this;
		}
		/**
		 * @param {WikiWindows} ww
		 */
		static getHandlers(ww) {
			return {
				open() {
					switch (ww.state) {
						case WikiWindows.NORMAL:
							ww.select();
							break;
						case WikiWindows.SELECT:
							ww.input();
							break;
						case WikiWindows.INPUT:
							ww.home();
					}
				},
				/**
				 * @param {{ currentTarget: any; preventDefault: () => void; }} event
				 */
				link(event) {
					// console.log(event, this);
					var target = event.currentTarget;
					if (ww.state === WikiWindows.SELECT) {
						ww.open(target);
						ww.home();
						event.preventDefault();
					}
				},
				go() {
					ww.open(ww.inputBox.val())
						.ready(function () {
							var windows = this.windows;
							windows.home();
						});
				}
			};
		}
		setClick() {
			$(document).on("click", "a", event => {
				var target = event.currentTarget;
				if (this.state === WikiWindows.SELECT) {
					this.open(target);
					this.home();
					event.preventDefault();
				}
			});
		}
		select() {
			this.$open.addClass("wikiwindows-select");
			this.state = WikiWindows.SELECT;
		}
		input() {
			this.$open.removeClass("wikiwindows-select")
				.addClass("wikiwindows-inputing");
			this.state = WikiWindows.INPUT;
			var $content = $("body");
			var input = new zui.Input({
				minWidth: "20em"
			});
			this.inputBox = input;
			var go = new zui.Button({
				text: "Go"
			});
			var edit = new zui.Button({
				text: "Edit"
			});
			go.click((/** @type {any} */ ev) => {
				this.open(this.inputBox.val()).ready(function () {
					this.windows.home();
				});
			});
			edit.click(() => input.val(input.val() + "?action=edit"));
			var layout = new zui.Layout(["前往：", input, go, edit]);
			this.layout = layout;
			layout.$element.appendTo($content);
			layout.$element.css({
				position: "fixed",
				top: "40%",
				width: "80%",
				background: "#f8f9fa"
			});
		}
		home() {
			if (this.state === WikiWindows.INPUT) {
				this.layout.$element.remove();
				this.layout = null;
			}
			this.$open.removeClass("wikiwindows-select")
				.removeClass("wikiwindows-inputing");
			this.state = WikiWindows.NORMAL;
		}
		/**
		 * @param {string | HTMLElement | JQuery<HTMLElement>} $link
		 */
		open($link) {
			var win = new Window($link, this.$element, this);
			if (win instanceof Error) {
				throw win;
			}
			this.windows.push(win);
			win.setOnclick();
			this.reorder();
			return win;
		}
		reorder() {
			var i, j = this.windows.length;
			if (j === 0) {
				this.$element.addClass("wikiwindows-empty")
			} else {
				this.$element.removeClass("wikiwindows-empty")
			}
			for (i = 0; i < j; i++) {
				this.windows[i].$element.css("z-index", 1001 + 10 * i)
					.animate({ "top": i * 3 + "em" });
			}
		}
		/**
		 * @param {number} index
		 */
		raise(index) {
			var win = this.windows.splice(index, 1)[0];
			this.windows.push(win);
			this.reorder();
		}
		/**
		 * @param {number} index
		 */
		hide(index) {
			var win = this.windows.splice(index, 1)[0];
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
			this.windows.push(win);
			this.reorder();
		}
		/**
		 * @param {number} index
		 */
		close(index) {
			this.windows.splice(index, 1)[0].$element.remove();
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
			Window.prototype.loadUI.call(obj, this.$element);
			obj.$done.on("click", () => { obj.$element.remove(); this.reorder() });
			var $interface = WikiWindows.Interface();
			$interface.appendTo(obj.$container);
			var $ul = $("<ul/>").appendTo($interface);
			$.each(scriptLoader.registry, (name, project) => {
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
			});
			obj.$element.show();
		}
	}
	$.extend(WikiWindows, {
		NORMAL: 0,
		SELECT: 1,
		INPUT: 2
	});
	if (window.scriptLoader) {
		var windows = new WikiWindows();
		window.windows = windows;
		var li = mw.util.addPortletLink("p-views", "javascript:void(0)", "加载器", "scriptloader-show");
		$(li).find("a").on("click", () => windows.showLoader());
		window.scriptLoader.send("wikiwindows", 1);
	} else {
		var windows = new WikiWindows();
		window.windows = windows;
	}
})(jQuery, mw, window.z ? z.ui : zui);