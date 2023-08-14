// @ts-check
/*
<pre>
This script is designed for Chinese wiki users.
本脚本专为中文用户设计。它的作用是，在语言为zh，含有多种变体的wiki上，
将链往锚点的链接根据正确链接、UTF-8转义链接和无锚点三种状态
高亮为绿、黄、红色，并修正UTF-8转义锚点链接。
</pre>
*/
/**
 * @typedef {{
 *   pageName: string;
 *   yellow?: boolean;
 *   this: string;
 *   $element: JQuery<HTMLAnchorElement>;
 *   color?: string
 * }} LinkData
 */

$(function () {
    var page = mw.config.get("wgPageName"), api = new mw.Api();
    if (mw.config.get("wgNamespaceNumber") < 0) { // 不高亮特殊页面
        return;
    }
    if (window.anchor) {
        return;
    }
    class Anchor {
        constructor() {
            
            /**
             * @type {JQuery.PlainObject<JQuery>}
             */
            this.pagesContent = {}
            this.$element = $("<div/>").attr("id", "linkhighlight").appendTo("body")
            this.$reloadButton = $("<div/>").addClass("linkhighlight-button").html("重新加载").appendTo(this.$element)
            this.$reloadButton.on("click", () => {
                if (this.loaded) {
                    this.loaded = false;
                    this.highlight();
                }
            });
        }
        highlight() {
            this.$reloadButton.css('text-decoration', "line-through");
            /**
             * @type {LinkData[]}
             */
            this.l2a = [];
            var $links = $("#mw-content-text").find("a");
            $links.each((_, linkEle) => {
                /**
                 * @type {JQuery<HTMLAnchorElement>}
                 */
                let $each = $(linkEle);
                let href = $each.attr("href");
                let matchResult = /^\/wiki\/(.+)(#.+)/.exec(href);
                if (!matchResult) {
                    return;
                }
                /**
                 * @type {LinkData}
                 */
                let each = {};
                each.pageName = decodeURI(matchResult[1]);
                let anch = matchResult[2];
                if (new mw.Title(each.pageName).namespace < 0) {
                    return;
                }
                if (/\.\w/.test(anch)) {
                    each.yellow = true;
                    anch = decodeURI(anch.replace(/\./g, '%'));
                }
                $each.addClass("links-to-anchors");
                each.this = anch;
                each.$element = $each;
                this.l2a.push(each);
            
            });

            console.log('All links to anchors: ', this.l2a);
            this.processOnce(0);
        }
        finishRest() { //完成剩余部分
            let found = false;
            for (let i = 0; i < this.l2a.length; i++) {
                var each = this.l2a[i];
                console.log(each);
                if (each.color == "#FFD") {
                    found = true;
                    console.log("待修复");
                    break
                }
            }
            this.$highlightButton = $("<div/>")
            this.$highlightButton
                .addClass("linkhighlight-button")
                .html("锚链高亮")
                .appendTo(this.$element)
                .on("click", () => this.onoff());
            
            this.$fixButton = $("<div/>")
            this.$fixButton
                .addClass("linkhighlight-button")
                .html("修复转义")
                .appendTo(this.$element);
            
            if (!found) {
                this.$fixButton.hide();
            }
            this.$fixButton.on("click", () => {
                if (!found) {
                    return mw.notify("似乎不需要修复。");
                }
                api.edit(page, data => {
                    let content = data.content
                    let newContent = content.replace(/\[\[.+?#.+?(\|.+?|)\]\]/g, res => {
                        let matchResult = /\[\[(.+?)#(.+?)(\|(.+?)|)\]\]/.exec(res);
                        console.log(matchResult);
                        let decoded;
                        if (/\.\w\w/.test(matchResult[2])) {
                            decoded = decodeURI(matchResult[2].replace(/\./g, "%"));
                        }
                        let r = `[[${matchResult[1]}#${decoded ? decoded : matchResult[2]}${matchResult[4] ? "|" + matchResult[4] : ""}]]`;
                        return r;
                    });
                    return newContent
                }).done(response => {
                    console.log("Edit response: ", response);
                    if (!response.edit || response.edit.result !== "Success") {
                        return mw.notify("哦豁，编辑的时候出了点小问题……");
                    }
                    mw.notify("成功！");
                    this.$fixButton.hide();
                    // 隐藏
                    api.get({
                        "action": "compare",
                        "format": "json",
                        "fromrev": response.edit.oldrevid,
                        "torev": response.edit.newrevid,
                        "formatversion": "2"
                    }).done(CR => {
                        console.log("Compare Result: ", CR);
                        if (CR.compare) {
                            $("#mw-content-text").prepend(
                                $("<div>").html(CR.compare.body).addClass("mw-collapsible")
                            );
                        } else {
                            mw.notify("哦豁，比较的时候出了点问题……");
                        }
                    });
                    
                    
                });
            });   
        }
        onoff() {
            if (this.isON) {
                for (let each of this.l2a) {
                    each.$element.css("background-color", "");
                }
                this.isON = false;
                this.$highlightButton.css('background-color', "");
            } else {
                for (let each of this.l2a) {
                    each.$element.css("background-color", each.color);
                }
                this.isON = true;
                this.$highlightButton.css('background-color', 'rgba(17,34,68,0.2)');
            }
        }
        // 页面内容使用jQuery对象存储。
        /**
         * 
         * @param {LinkData} link
         * @returns 
         */
        categorize(link) {
            var pageName = link.pageName;
            var $content = this.pagesContent[pageName];
            if (!$content) {
                return;
            }
            var $headlines = $content.find(".mw-headline");
            var $span = $("<span/>").addClass("links-to-anchors-span");
            var $div = $("<div/>").addClass("links-to-anchors-div");
            $headlines.each((_, header) => {
                var id = $(header).attr("id");
                var a = $("<a/>").html(id).attr("href", `/wiki/${pageName}#${encodeURI(id)}`);
                $div.append(a).append("、");
            })
            link.$element.append($span.append($div));
            try { // 防止jQuery抛出错误
                link.color = $content.find(link.this)[0] ? (link.yellow ? "#FFD" : "#DFD") : "#FDD";
                return;
            } catch (err) {
                console.log(err.message, "错误");
            }
            link.color = "#FDD";
        }
        /**
         * 
         * @param {number} index 
         * @returns 
         */
        processOnce(index) {
            if (index == this.l2a.length) {
                this.ready(index == 0);
                return;
            }
            var each = this.l2a[index];
            if (this.pagesContent[each.pageName]) {
                this.categorize(each);
                this.processOnce(index + 1)
            } else {
                api.get({
                    action: "parse",
                    format: "json",
                    formatversion: "2",
                    redirects: 1,
                    page: each.pageName
                }).done(result => {
                    console.log("Result: ", result)
                    if (result.parse) {
                        this.pagesContent[each.pageName] = $("<div>").html(result.parse.text);
                        this.categorize(each);
                    }
                    this.processOnce(index + 1);
                });
            }
        }
        /**
         * 
         * @param {boolean} no 
         */
        ready(no) {
            if (no) {
                mw.notify("没有锚链");
            } else {
                mw.notify("锚链高亮准备就绪");
                if (!this.firstLoaded) {
                    this.finishRest();
                    this.firstLoaded = true;
                }
                this.onoff();
                if (!this.isON) {
                    this.onoff();

                }
            }
            this.loaded = true;
            $("#linkhighlight-reload").css('text-decoration', '');
        }
    };
    var anchor = window.anchor = new Anchor()
    if (window.scriptLoader) {
        anchor.highlight();
        scriptLoader.send("linkhighlight", 1);
    } else {
        anchor.highlight()
    }
});