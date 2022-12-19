// @ts-check

$(function () {
    var page = mw.config.get("wgPageName"), api = new mw.Api();
    if (/^Special\:/.exec(page)) { // 不高亮特殊页面
        return;
    }
    if (window.anchor) {
        return;
    }
    var anchor = {
        highlight() {
            $("#linkhighlight-reload").css('text-decoration', "line-through");
            this.l2a = [];
            var links = $("#mw-content-text").find("a");
            var linksLen = links.length;
            var i;
            for (i = 0; i < linksLen; i++) {
                let one = links[i];
                let each = {};
                let href = one.attributes.href;
                let hrefValue = href ? href.value : "";
                let matchResult = /^\/wiki\/(.+)(#.+)/.exec(hrefValue);
                if (matchResult) {
                    each.pageName = decodeURI(matchResult[1]);
                    let anch = matchResult[2];
                    if (new mw.Title(each.pageName).namespace < 0) {
                        continue;
                    }
                    if (/\.\w/.test(anch)) {
                        each.yellow = true;
                        anch = decodeURI(anch.replace(/\./g, '%'));
                    }
                    one.classList.add("links-to-anchors");
                    each.anchor = anch;
                    each.link = one;
                    anchor.l2a.push(each);
                }
            }

            console.log('All links to anchors: ', anchor.l2a);
            anchor.processOnce(0);
        },
        finishRest() { //完成剩余部分
            let found = false;
            for (let i = 0; i < anchor.l2a.length; i++) {
                var each = anchor.l2a[i];
                console.log(each);
                if (each.color == "#FFD") {
                    found = true;
                    console.log("待修复");
                    break
                }
            }
            $("#linkhighlight").append('<div id="linkhighlight-button-highlight" class="linkhighlight-button">锚链高亮</div>')
            $(".linkhighlight-button").on("click", () => {
                console.log(anchor);
            });
            
            $("#linkhighlight-button-highlight").on("click", anchor.onoff);
            $("#linkhighlight").append(
                $("<div>").addClass("linkhighlight-button").attr("id", "linkhighlight-fix-UTF-8").html("修复转义")
            );
            if (!found) {
                $("#linkhighlight-fix-UTF-8").hide();
            }
            $("#linkhighlight-fix-UTF-8").on("click", () => {
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
                    })
                    return newContent
                }).done((response) => {
                    console.log("Edit response: ", response);
                    if (!response.edit || response.edit.result !== "Success") {
                        return mw.notify("哦豁，编辑的时候出了点小问题……");
                    }
                    mw.notify("成功！");
                    $("#linkhighlight-fix-UTF-8").hide();
                    //隐藏
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
        },
        onoff(on) {
            if (anchor.isON) {
                for (let i = 0; i < anchor.l2a.length; i++) {
                    var each = anchor.l2a[i];
                    each.link.style["background-color"] = "";
                }
                anchor.isON = false;
                $("#linkhighlight-button-highlight").css('background-color', "");
            } else {
                for (let i = 0; i < anchor.l2a.length; i++) {
                    var each = anchor.l2a[i];
                    each.link.style["background-color"] = each.color;
                }
                anchor.isON = true;
                $("#linkhighlight-button-highlight").css('background-color', 'rgba(17,34,68,0.2)');
            }
        },
        pagesContent: {},
        // 页面内容使用jQuery对象存储。
        categorize(each) {
            var pageName = each.pageName;
            var content = this.pagesContent[pageName];
            if (content) {
                var headlines = content.find(".mw-headline");
                var span = $("<span>").addClass("links-to-anchors-span");
                var div = $("<div>").addClass("links-to-anchors-div");
                var hi;
                for (hi = 0; hi < headlines.length; hi++) {
                    var header = $(headlines[hi]);
                    var id = header.attr("id");
                    var a = $("<a/>").html(id).attr("href", `/wiki/${pageName}#${encodeURI(id)}`);
                    div.append(a).append("、");
                }
                $(each.link).append(span.append(div));
                try { // 防止jQuery抛出错误
                    if (content.find(each.anchor)[0]) {
                        if (each.yellow) {
                            each.color = "#FFD";
                            return;
                        } else {
                            each.color = "#DFD";
                            return;
                        }
                    }
                }
                catch (err) {

                }
            }
            each.color = "#FDD";
        },

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
                }).done(function (result) {
                    console.log("Result: ", result)
                    if (result.parse) {
                        anchor.pagesContent[each.pageName] = $("<div>").html(result.parse.text);
                        anchor.categorize(each);
                    }
                    anchor.processOnce(index + 1);
                });
            }
        },

        ready(no) {
            if (no) {
                mw.notify("没有锚链");
            } else {
                mw.notify("锚链高亮准备就绪");
                if (!this.firstLoaded) {
                    this.finishRest();
                    anchor.firstLoaded = true;
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
    $("body").append('<div id="linkhighlight"></div>');
    $("#linkhighlight").append('<div id="linkhighlight-reload" class="linkhighlight-button">重新加载</button>');
    $("#linkhighlight-reload").on("click", () => {
        if (anchor.loaded) {
            anchor.loaded = false;
            anchor.highlight();
        }
    });
    if (window.scriptLoader) {
        anchor.highlight();
        scriptLoader.send("linkhighlight", 1);
    } else {
        anchor.highlight()
    }
});