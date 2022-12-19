"use strict";
(function ($, mw, OO) {
	/** @type {zUtil} */
	var z = {};
	z.$element = $("<div/>");
	z.$element.attr("id", "zutil")
		.prependTo("#mw-content-text");
	function Console() {
		var con = this;
		this.text = "";
		this.$element = $("<div/>");
		this.$element
			.attr("id", "zutil-console")
			.addClass("zutil-console-collapsed")
			.prependTo(z.$element);
		this.$collapse = $("<div/>").prependTo(z.$element).addClass("zutil-console-collapse")
			.on("click", function () {
				con.$element.toggleClass("zutil-console-collapsed")
			})
		this.element = con.$element[0]; // 控制台输出
		this.$input = $("<textarea/>");  // 输入框
		this.$input.insertAfter(con.$element);
		this.$input.attr("id", "zutil-input");
		this.$input.on("input", function () {
			con.text = con.$input.val();
			if (/^\s*?$/.test(con.text)) {
				if (!con.disabled) {
					con.setDisabled(true);
				}
			} else if (con.disabled) {
				con.setDisabled(false);
			}
			var m = con.text.match(/\n/g);
			var line = m ? m.length : 0;
			line = line <= 3 ? 4 : line + 1;
			con.$input.css("height", line + "em");
		});
		this.$input.on("keypress", function (e) {
			if (e.which === 13) {
				if (!e.shiftKey) {
					e.preventDefault(); // 按住shift+enter 换行
					if (!con.disabled) con.run();
				}
			}
		});
		this.disabled = true;
		this.button = new OO.ui.ButtonWidget({
			autosize: true,
			flags: ["progressive", "primary"],
			align: "inline",
			label: "运行！"
		});
		this.button.setDisabled(true);
		this.button.$element.insertAfter(con.$input);
		this.button.$element.on("click", function () {
			con.run();
		});
		this.clearButton = new OO.ui.ButtonWidget({
			autosize: true,
			flags: ["destructive"],
			align: "inline",
			label: "清除"
		});
		this.$clear = con.clearButton.$element.appendTo(z.$element).click(function () {
			con.clear();
		});
		$(window).on("error", function (ev) {
			var err = ev.originalEvent.error;
			if (!err) { return }
			var stack = err.stack || err.toString(), $span;
			stack = stack.replace(/>/g, "&gt;");
			stack = stack.replace(/</g, "&lt;");
			stack = stack.replace(/(http.*?)(\s|\))/g, function (match, href) {

				try {
					new URL(href);
					return '<a href="' + href + '">' + href + '</a>';
				} catch (e) {
					return match;
				}
			});
			$span = $("<span/>");
			$span.css("whiteSpace", "pre").text(err.message + "\n" + stack);
			con.addLine("err", $span, z.makeValue(ev.originalEvent));
		});
		var builtinLog = console.log;
		console.log = function log() {
			z.log.apply(z, arguments);
			builtinLog.apply(console, arguments);
		};
	}

	Console.prototype = {
		constructor: Console,
		toBottom: function () { // 到底部
			var element = this.element;
			var oldScrollTop = element.scrollTop;
			$(".zutil-back").remove();
			element.scrollTop = element.scrollHeight;
			if (oldScrollTop === element.scrollTop) return;
			z.triangle().addClass("zutil-back").attr("title", "返回到刚刚位置")
				.css({
					transform: "rotate(270deg)",
					float: ""
				}).insertBefore(this.$input).on("click", function () {
					element.scrollTop = oldScrollTop;
					$(this).remove();
				});
		},
		setDisabled: function (bool) {
			this.disabled = bool;
			this.button.setDisabled(bool);
		},
		run: function () {
			if (this.disabled) {
				return;
			}
			this.addLine("in", this.text);
			try {
				z.evaluate(
					new Function(
						"z0", "z1", "z2",
						"z3", "z4", "z5",
						"return (" + this.text + ")"
					).apply(window, z.recentNodes)
				);
				this.toBottom();
			} catch (e) {
				try {
					z.evaluate(
						new Function(
							"z0", "z1", "z2",
							"z3", "z4", "z5",
							this.text
						).apply(window, z.recentNodes)
					);
					this.toBottom();
				} catch (err) {
					throw err;
				}
			}
			this.text = "";
			this.$input.val("");
			this.setDisabled(true);
		},
		log: function () {
			var arr = ["out"];
			var j = arguments.length;
			for (var i = 0; i < j; i++) {
				if (typeof arguments[i] === "string") {
					var $span = $("<span/>").addClass("zutil-normal-log").text(arguments[i]);
					arr.push($span);
				} else {
					arr.push(z.makeValue(arguments[i]));
				}
			}
			this.addLine.apply(this, arr);
		},
		logAsValue: function (obj) {
			return this.addLine("out", z.isNode(obj) ? z.showNode(obj) : z.makeValue(obj));
		},
		addLine: function (type) {
			type = type || "out";
			var line = {};
			line.$element = $("<div/>")
				.addClass("zutil-console-line")
				.addClass(type);
			line.$element.appendTo(this.$element);
			for (var i = 1; i < arguments.length; i++) {
				line.$element.append(arguments[i]);
			}

		},
		clear: function () {
			this.$element.html("");
		},
		reheight: function (height) {
			if (typeof height === "function") {
				this.$element.css("height", height.call(this, this.$element.height()));
			} else {
				this.$element.css("height", height);
			}
		}
	};
	$.extend(z, {
		recentNodes: [],
		log: function () {
			return this.console.log.apply(this.console, arguments);
		},
		evaluate: function (obj) {
			return this.console.logAsValue(obj);
		},
		makeValue: function (v, params) {
			params = params || {};
			var $e = $("<span/>");
			$e.addClass("zutil-object-" + typeof v);
			switch (typeof v) {
				case "string":
					if (z.lenByte(v) > 1024) {
						var s = v.slice(0, 127) + "...";
						$e.addClass("overflow");
						$e.html(JSON.stringify(z.escape(s)));
						var $span = $("<span/>")
							.css("background-color", "silver")
							.css("color", "#111")
							.appendTo($e)
							.html(z.lenByte(v) / 1024 + "KB");
						/*var $btn = $("<a/>")
							.addClass("zutil-clip")
							.appendTo($e)
							.html("COPY");
						new window.ClipboardJS($btn[0], {
							text: function () { return v }
						});*/
					} else {
						$e.html(JSON.stringify(z.escape(v)));
					}
					break;
				case "number":
					$e.html(v + "");
					break;
				case "function":
					if (params.isProperty) {
						var f = $("<span/>").html("f&nbsp;").css("color", "#0022ff")
							, $s = $("<span/>").appendTo($e).html(f);
						var code = v.toString();
						var nspCode = code.replace(/\s/g, "");
						var funcHead, match;
						if (match = /^(async\s+)?function\s*([^{]*?\))/.exec(code)) {
							funcHead = match[2];
							if (match[1]) {
								funcHead += "[async]";
							}
						} else if (match = /^(async)?([\{\(]*?)=>/.exec(nspCode)) {
							// [async ](...)=>
							funcHead = match[1] + match[2];
						} else if (match = /^class\s+?([^\{]*?)\s+(extends\s+[^\{]*?\s+)?\{/.exec(code)) {
							// class Class [extends Super ]{
							funcHead = "class " + match[1] + (match[2] ? " " + match[2] : "");

						} else if (match = /^(async\s+)?([^\{]*\))\s*?\{/.exec(code)) {
							// [async ]method(...) {
							funcHead = (match[1] || "") + (match[2] || "") + match[3];
						}
						$s.append(funcHead);
						$s.attr("title", code);
						/* 悬浮展示源代码 */
						var d = $("<span/>");
						d.html(
							$("<div/>").addClass("zutil-object-function-code").html(z.escape(code))
						);
						d.css("position", "relative");
						d.hide();
						d.insertAfter($s);
						/* 关闭键 */
						var x = $("<div/>");
						x.appendTo(d);
						x.css({
							borderRadius: "3px",
							left: "calc(3em - 6px)",
							height: "6px",
							width: "6px",
							backgroundColor: "red",
							position: "absolute"
						});
						x.on("click", function () {
							d.hide();
							$(this).hide();
						});
						x.hide();
						$s.on("click", function () {
							d.show();
							x.show();
						});
						if (!params.noexpand) {
							z.expandObject($e, $s, v, $e);
						}
					} else {
						$e.addClass("zutil-object-function-block");
						$e.html(z.escape(v.toString()));
					}
					break;
				case "object":
					if (v === null) {
						$e.css("color", "silver").html("null");
						break;
					}
					var conName;
					if (z.isNode(v)) {
						conName = z.reprNode(v);
					} else {
						var pt = Object.getPrototypeOf(v);
						if (pt && pt.constructor) {
							conName = pt.constructor.name;
						} else {
							conName = "UnknownObject";
						}
					}
					if (conName === "") {
						conName = "(Anon)";
					}
					var $s = $("<span/>");
					$s.appendTo($e);
					$s.html(conName !== undefined ? conName : "UnknownObject");
					if (z.isArrayLike(v))
						$s.append("(" + v.length + ")");
					if (!params.noexpand) {
						z.expandObject($e, $s, v);
					}
					break;
				case "boolean":
					$e.css("color", v ? "green" : "red");
					$e.html(v ? "true" : "false");
					break;
				case "undefined":
					$e.css("color", "grey");
					$e.html("undefined");
					break;
				default:
					return JSON.stringify(v);
			}
			return $e;
		},
		expandObject: function ($e, $s, v) {
			var ownProps = Object.keys(v);
			var expand, expanded = false;
			var triangle = z.triangle();
			var ptt = Object.getPrototypeOf(v);
			expand = $("<div/>");
			expand.addClass("zutil-expand");
			expand.appendTo($e);
			triangle.prependTo($e);
			/**
			 * expandLine: 展开普通的一行。
			 * 
			 * @param {string} key
			 * 显示的键。
			 * @param {"purple"|"pink"|"#999"} color
			 * 显示键的颜色。可枚举属性为紫色，不可枚举为粉色，原型为#999。
			 * @param {boolean} bold
			 * 是否加粗。粗体仅用于自有可枚举属性。
			 * @param {jQuery<HTMLElement>} value
			 * z.makeValue返回的值显示。
			 * @param {boolean} isPrototype
			 * 是否为原型。如果是原型，被删除时等于删除原型。一般不会操作原型。
			 */
			function expandLine(key, color, bold, value, isPrototype) {
				var $line = $("<div/>");
				var $sp = $("<span/>");
				var $del = $("<span/>");
				$line.addClass("zutil-expand-line");
				$sp.appendTo($line);
				$sp.html(key);
				$sp.css("color", color);
				if (bold) {
					$sp.css("font-weight", "bold");
				}
				$line.append("&nbsp;:&nbsp;&nbsp;");
				$line.append(value);
				$del.html("删除该属性");
				$del.addClass("zutil-property-del");
				$del.prependTo($line);
				$del.css({
					color: "red"
				});
				$del.one("click", function () {
					if (isPrototype) {
						Object.setPrototypeOf(v, null);
					} else {
						delete v[key];
						$line.css("text-decoration", "line-through");
						$(this).remove();
					}
				});
				expand.append($line);
				$line.prepend(value.children(".zutil-triangle"));
			}
			/**
			 * expandArrayFraction: 展开数组中的一个片段。
			 * @param {Array<number>} nums
			 * 数组中的数字键。
			 * @param {boolean} bold
			 * 是否加粗。粗体用于数组本身。
			 */
			function expandArrayFraction(nums, bold) {
				var $line = $("<div/>")
					, $s = $("<span/>")
					, start = nums[0]
					, end = nums[nums.length - 1];
				$line.addClass("zutil-array-line");
				if (bold) {
					$s.css("font-weight", "bold");
				}
				$s.append("[" + start + "-" + end + "]");
				$line.append($s);
				var frac = Object.create(null);
				$.each(nums, function (_, index) {
					frac[index] = v[index];
				});
				expand.append($line);
				z.expandObject($line, $s, frac);
			}
			/**
			 * quickSort: 快速排序，不解释。
			 * @param {Array<number>} nums
			 */
			function quickSort(nums) {
				if (nums.length <= 1) {
					return nums;
				}
				$.each(nums, function (k, v) {
					nums[k] = parseInt(v);
				});
				var left = [], right = [];
				var length = nums.length;
				var mid = nums[Math.round(length / 2)];
				for (var i = 0; i < length; i++) {
					var item = nums[i];
					if (item > mid) {
						right.push(item);
					} else if (item < mid) {
						left.push(item);
					}
				}
				var result = quickSort(left);
				result.push(mid);
				result = result.concat(quickSort(right));
				return result;
			}
			/**
			 * sortArray: 整理一个含有数字和字符串的数组。
			 * 对于数字部分，使用快速排序；
			 * 对于字符串部分，使用内建Array.prototype.sort。
			 * 当数组部分大于100，会返回一个对象，将两部分分开。
			 * @returns {
			 *  Array<any>|
			 *  {
			 *   n: Array<number>,
			 *   nn: Array<string>
			 *  }
			 * }
			 */
			function sortArray(arr) {
				var numbers = [];
				var nonNumbers = [];
				$.each(arr, function (_, item) {
					if (/^\d+$/.test(item)) {
						numbers.push(item);
					} else {
						nonNumbers.push(item);
					}
				});
				nonNumbers.sort();
				numbers = quickSort(numbers);
				return (numbers.length > 100) ? { n: numbers, nn: nonNumbers } : numbers.concat(nonNumbers);
			}
			/**
			 * lookUpPrototype: 递归查找原型中的getter，并应用于本值（v）。
			 * 该函数是一个递归函数。
			 * @returns {void}
			 */
			function lookUpPrototype(obj, keyseen) {
				var ptt = Object.getPrototypeOf(obj);
				if (!ptt) {
					return;
				}
				var des = Object.getOwnPropertyDescriptors(ptt);
				var keys = sortArray(Object.keys(des));
				if (!Array.isArray(keys)) {
					var nums = keys.n;
					keys = keys.nn;
					var fracs = divideFractions(nums);
					$.each(fracs, function (_, frac) {
						expandArrayFraction(frac);
					});
				}
				$.each(keys, function (_, key) {
					var val = des[key];
					if (keyseen.includes(key) || ("value" in val && typeof val.value === "function")) {
						return;
					}
					keyseen.push(key);
					if (val.configurable && val.get) {
						try {
							expandLine(key, "purple", false, z.makeValue(val.get.call(v), { isProperty: true }));
						} catch (e) {
							expandLine(key, "purple", false, z.makeValue(e.stack));
						}

					} else {
						expandLine(key, "purple", false, z.makeValue(val.value, { isProperty: true }));
					}
				});
				lookUpPrototype(ptt, keyseen);
			}
			/**
			 * repeat: 重复运行函数。
			 * @param {number} t
			 * @param {()=>any} fn
			 * @returns {void}
			 */
			function repeat(t, fn) {
				var i;
				for (i = 0; i < t;) {
					var r = fn(i);
					if (r === false) {
						break;
					} else if (typeof r === "number") {
						i = r;
					} else {
						i++;
					}
				}
			}
			/**
			 * divideFractions: 将数组分解为100个一段。
			 * @param {Array<number>} numIndexes
			 * @returns {Array<Array<number>>}
			 */
			function divideFractions(numIndexes) {
				var length = numIndexes.length;
				var fracs = [];
				repeat(Infinity, function (i) {
					var frac = [];
					repeat(100, function () {
						if (i >= length) {
							return false;
						}
						frac.push(numIndexes[i]);
						i++;
					});
					fracs.push(frac);
					if (i >= length) {
						return false;
					}
					return i;
				});
				return fracs;
			}
			$().pushStack([$s[0], triangle[0]]).on("click", function () {
				if (expanded) {
					expand.html("");
					triangle.css("transform", "");
					expanded = false;
				} else {
					triangle.css("transform", "rotate(90deg)");
					expanded = true;
					var keyseen = [];
					var des = Object.getOwnPropertyDescriptors(v);
					var keys = sortArray(Object.keys(des));

					if (!Array.isArray(keys)) {

						var numbers = keys.n;
						keys = keys.nn;
						var fracs = divideFractions(numbers);
						$.each(fracs, function (_, frac) {
							expandArrayFraction(frac, true);
						});
					}

					$.each(keys, function (_, key) {
						keyseen.push(key);
						var val = des[key];
						var getter = val.get, setter = val.set;
						if (getter) {
							var $span = $("<span/>");
							expandLine("get&nbsp;" + key, "purple", true, z.makeValue(getter, { isProperty: true }));
							expandLine(key, "purple", true, $span);
							$span.html("(...)");
							$span.on("click", function () {

								try {
									$span.html(z.makeValue(getter.call(v), { isProperty: true }));
								} catch (e) {
									$span.html(z.makeValue(e.stack));
								}
							});
						} else {
							expandLine(key, val.enumerable ? "purple" : "pink",
								val.enumerable, z.makeValue(val.value, { isProperty: true }));
						}
						if (setter) {
							expandLine("set&nbsp;" + key, "purple", true, z.makeValue(setter, { isProperty: true }));
						}
						// console.log(key, value);
					});
					// console.log("prototype", Object.getPrototypeOf(v));
					if (ptt) {
						lookUpPrototype(v, keyseen);
						expandLine("[[prototype]]", "#999", false, z.makeValue(ptt, { isProto: true, isProperty: true }), true);
					}
				}
			});
		},
		showCSSStyleDeclaration: function (style) {
			var $e = $("<div/>"), i = 0, l = style.length;
			for (; i < l; i++) {
				var name = style[i];
				var value = style[name];
				var $line = $("<div/>").appendTo($e);
				$line.append(name)
					.append("&nbsp;:&nbsp;&nbsp;")
					.append(value)
					.append(";");

			}
			return $e;
		},
		showCSSRules: function (cssRule, notConsole) {
			if (!(cssRule instanceof CSSStyleRule)) {
				throw Error("不是样式规则");
			}
			var $e = $("<div/>");
			$e.text(cssRule.selectorText);
			var style = cssRule.style;
			var $style = z.showCSSStyleDeclaration(style);
			$style.css("paddingLeft", "2em");
			$style.appendTo($e);
			if (notConsole) {
				return $e;
			} else {
				z.console.addLine("out", $e);
			}
		},
		showCSSRuleList: function (rules, notConsole) {
			var $e = $("<div/>"), i = 0, l = rules.length;
			for (; i < l; i++) {
				$e.append(z.showCSSRules(rules[i]));
			}
			if (notConsole) {
				return $e;
			} else {
				z.console.addLine("out", $e);
			}
		},
		showMatchedCSSRules: function (element, notConsole) {
			var $e = z.showCSSRuleList(window.getMatchedCSSStyleRules(element), true);
			var $elSt = $("<div/>").prependTo($e);
			$elSt.text("element.style");
			$elSt.append(z.showCSSStyleDeclaration(element.style).css("paddingLeft", "2em"));
			if (notConsole) {
				return $e;
			} else {
				z.console.addLine("out", $e);
			}
		},
		escape: function (s) {
			return $("<div/>").text(s).html();
		},
		isNative: function (fn) {
			return /^function [\$\w]*\(\) ?\{ ?\[native code\]/.test(fn.toString());
		},
		isArrayLike: function (obj) {
			var length = "length" in obj && z.tryGet(obj, "length"),
				type = $.type(obj);
			if (type === "function" || $.isWindow(obj)) {
				return false;
			}
			try {
				if (obj.nodeType === 1 && length) {
					return true;
				}
			} catch (e) { }
			return type === "array" || length === 0 || typeof length === "number" && length > 0 && (length - 1) in obj;
		},
		triangle: function () {
			return $("<div/>").addClass("zutil-triangle");
		},
		loadCSS: function (href) {
			var dfd = $.Deferred();
			$("<link>").attr("rel", "stylesheet").attr("href", href).appendTo(document.head).on("load", function () { dfd.resolveWith(dfd, [this]) });
			return dfd.promise();
		},
		lenByte: function (str) {
			var byteLen = 0, len = str.length;
			if (str) {
				for (var i = 0; i < len; i++) {
					if (str.charCodeAt(i) > 255) {
						byteLen += 2;
					} else {
						byteLen++;
					}
				}
				return byteLen;
			} else {
				return 0;
			}
		},
		isDocument: function (obj) {
			if (z.tryGet(obj, "defaultView")) {
				var dv = z.tryGet(obj, "defaultView");
				if (dv instanceof dv.Window) {
					if (typeof dv.HTMLDocument === "function") {
						return obj instanceof dv.HTMLDocument;
					}
				}
			}
		},
		isNode: function (obj) {
			if (z.isDocument(obj)) {
				return true;
			} else if (z.tryGet(obj, "ownerDocument")) {
				var od = z.tryGet(obj, "ownerDocument");
				if (z.isDocument(od)) {
					return obj instanceof od.defaultView.Node;
				} else {
					return false;
				}
			}
		},
		reprNode: function (node) {
			var $e = $("<span/>");
			$e.addClass("zutil-node-repr");
			switch (node.nodeType) {
				case Node.ELEMENT_NODE:
					var $tn = $("<span/>").html(node.tagName.toLowerCase());
					$tn.css("color", "#800080");
					$tn.appendTo($e);
					if (node.id) {
						var $id = $("<span/>").html("#" + node.id);
						$id.appendTo($e);
					}
					if (node.classList) {
						var classes = $("<span/>").css("color", "#A93").appendTo($e);
						$.each(node.classList, function (_, cls) {
							classes.append("." + cls);
						});
					}
					return $e;
				case Node.TEXT_NODE:
					$e.html("text").css("color", "#800080");
					return $e;
				case Node.COMMENT_NODE:
					$e.html("comment").css("color", "#800080");
					return $e;
				case Node.DOCUMENT_NODE:
					$e.html("document").css("color", "#800080");
					return $e;
				case Node.DOCUMENT_TYPE_NODE:
					$e.html("&lt;!DOCTYPE&nbsp;" + node.name + "&gt;").css("color", "#800080");
					return $e;
			}
		},
		tryGet: function (obj, prop) {
			try {
				return obj[prop];
			} catch (e) {
				return undefined;
			}
		},
		showNode: function (node) {
			var $e = $("<div/>").addClass("zutil-node");
			function select(target, nd, ele) {
				target.on("click", function () {
					nd = nd || node;
					ele = ele || $e;
					$(".zutil-node .isz0").remove();
					$(".zutil-node.select").each(function () {
						$(this).removeClass("select");
					});
					ele.addClass("select");
					$("<span/>")
						.html("&nbsp;==&nbsp;z0")
						.addClass("isz0")
						.attr("title", "在控制台中使用z0代替此节点。")
						.appendTo(target);
					if (z.recentNodes[0] === nd) {
						return;
					}
					z.recentNodes.unshift(nd);
					if (z.recentNodes.length > 6) {
						z.recentNodes.pop();
					}
				});
			}
			switch (node.nodeType) {
				case Node.ELEMENT_NODE:
					$e.addClass("ele");
					var tagName = node.tagName.toLowerCase()
						, $tag = $("<span/>").append("&lt;")
						, $t = $("<span/>").html(tagName).addClass("tag-name")
						, i
						, attrs = node.attributes
						, children = node.childNodes;
					select($tag);
					$e.append($tag.append($t));
					for (i = 0; i < attrs.length; i++) {
						$tag.append("&nbsp;");
						var attr = attrs[i];
						var $name = $("<span/>").addClass("attr-name").html(attr.name)
							, $value = $("<span/>").addClass("attr-value").html(JSON.stringify(attr.value));
						$tag.append($name)
							.append("=")
							.append($value);

					}
					$tag.append("&gt;");
					if (node.outerHTML.endsWith(tagName + ">")) {
						if (node.innerHTML !== "") {
							if (children.length === 1 && children[0].nodeType === 3) {
								if ((tagName === "script" || tagName === "style")
									&& children[0].textContent.length > 256) {
									var $con = $("<span/>").html("...").addClass("node-content").appendTo($e)
										, $tri = z.triangle();
									var text = children[0].textContent.length > 1024 ?
										children[0].textContent.slice(0, 1024) + "..." :
										children[0].textContent;
									$tri.prependTo($e);
									$tri.on("click", function () {
										if ($con.hasClass("expanded")) {
											$tri.css("transform", "");
											$con.removeClass("expanded");
											$e.removeClass("expanded");
											$con.html("...");
										} else {
											$con.html("");
											$tri.css("transform", "rotate(90deg)");
											$con.addClass("expanded");
											$e.addClass("expanded");
											var $text = $("<div/>").addClass("zutil-node text").text(text).appendTo($con);
											select(
												$text, children[0], $text
											);
										}
									});
								} else {
									$e.append($("<span/>").addClass("text").text(children[0].textContent));
								}
							} else {
								var $con = $("<span/>").html("...").addClass("node-content").appendTo($e)
									, $tri = z.triangle();
								$tri.prependTo($e);
								$tri.on("click", function () {
									if ($con.hasClass("expanded")) {
										$tri.css("transform", "");
										$con.removeClass("expanded");
										$e.removeClass("expanded");
										$con.html("...");
									} else {
										$con.html("");
										$tri.css("transform", "rotate(90deg)");
										$con.addClass("expanded");
										$e.addClass("expanded");
										for (i = 0; i < children.length; i++) {
											$con.append(z.showNode(children[i]));
										}
									}
								});
							}
						} else if (tagName === "iframe") {
							var $con = $("<span/>").html("...").addClass("node-content").appendTo($e)
								, $tri = z.triangle();
							$tri.prependTo($e);
							$tri.on("click", function () {
								if ($con.hasClass("expanded")) {
									$tri.css("transform", "");
									$con.removeClass("expanded");
									$e.removeClass("expanded");
									$con.html("...");
								} else {
									$con.html("");
									$tri.css("transform", "rotate(90deg)");
									$con.addClass("expanded");
									$e.addClass("expanded");
									$con.append(z.showNode(node.contentDocument));
								}
							});
						}
						select(
							$("<span/>").append("&lt;/")
								.append($t.clone())
								.append("&gt;")
								.appendTo($e)
						);
					}
					return $e;
				case Node.TEXT_NODE:
					if (/^\s+$/.test(node.textContent)) return $e;
					$e.addClass("text")
						.append('"')
						.append(node.textContent)
						.append('"');
					select($e);
					return $e;
				case Node.COMMENT_NODE:
					$e.addClass("comment")
						.append("&lt;!--")
						.append(node.nodeValue)
						.append("--&gt;");
					select($e);

					return $e;
				case Node.DOCUMENT_NODE:
					$e.html("#document");
					var $con = $("<span/>")
						, $tri = z.triangle();

					$con.html("")
						.addClass("node-content")
						.appendTo($e)
						.css("paddingLeft", "2em");

					$tri.prependTo($e);
					$tri.on("click", function () {
						if ($con.hasClass("expanded")) {
							$tri.css("transform", "");
							$con.removeClass("expanded");
							$e.removeClass("expanded");
							$con.html("");
						} else {
							$con.html("");
							$tri.css("transform", "rotate(90deg)");
							$con.addClass("expanded");
							$e.addClass("expanded");
							if (node.doctype) {
								$con.append(z.showNode(node.doctype));
							}

							$con.append(z.showNode(node.documentElement));
						}
					});

					return $e;
				case Node.DOCUMENT_TYPE_NODE:
					$e.addClass("doctype").html("&lt;!DOCTYPE&nbsp;" + node.name + "&gt;");
					select($e);
					return $e;
				default:
					return $e;
			}
		},
		nullEdit: function (page, async) {
			return new mw.Api().edit(page, function (r) {
				return r.content;
			}, { "async": async || false });
		}
	});
	//$.getScript("https://cdn.jsdelivr.net/npm/clipboard@2.0.6/dist/clipboard.js", function() {
	if (window.scriptLoader) {
		z.console = new Console();
		z.log("控制台已加载！");
		z.evaluate(z);
	} else {
		mw.loader.using(["oojs-ui", "oojs-ui-core"], function () {
			z.loadCSS("//rs.miraheze.org/wiki/Zes M Young/Util.css?action=raw&ctype=text/css").done(function () {
				z.console = new Console();
				z.log("控制台已加载！");
			});
		});
	}
	var _z = window.z;
	var _zUtil = window.zUtil;
	z.noConflict = function (deep) {
		if (_z) {
			window.z = _z;
		}
		if (deep && _zUtil) {
			window.zUtil = _zUtil;
		}
	};
	window.z = z;
})(jQuery, mw, OO);
