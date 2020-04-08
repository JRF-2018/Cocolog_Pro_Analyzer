// ==UserScript==
// @name        Cocolog_Pro_Analyzer
// @namespace   http://jrf.cocolog-nifty.com/
// @description ココログ・プロ用アクセス解析拡張＋α
// @include     http://app.cocolog-nifty.com/t/app/control/stats
// @include     http://app.cocolog-nifty.com/t/app/control/stats?*
// @include     http://app.cocolog-nifty.com/cms/blogs/*/access_analyze/*
// @include     https://app.cocolog-nifty.com/cms/blogs/*/access_analyze/*
// @include     http://ua.userlocal.jp/ua/admin/*
// @include     https://ua.userlocal.jp/ua/admin/*
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @grant	GM.xmlHttpRequest
// @grant	GM_getValue
// @grant	GM_setValue
// @grant	GM.getValue
// @grant	GM.setValue
// @version     0.08
// ==/UserScript==

var GM_ID = "Cocolog_Pro_Analyzer";
var BATCH_DATA_ID = GM_ID + ":batch_data";
var AGGREGATE_DATA_ID = GM_ID + ":aggregation";
var BATCH_DATA = null;

function bind (f, o) {
  return function() {return f.apply(o, arguments);};
}

function add_style(css) {
  var head = document.getElementsByTagName('head')[0];
  if (head) {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = css;
    head.appendChild(style);
    return style;
  } else {
    return null;
  }
}

function make_variable_injection(name, value) {
  return "window['" + name + "'] = decodeURIComponent(\""
    + encodeURIComponent(value) + "\");\n";
}

function make_code_injection(no_name_function) {
  return "(" + no_name_function + ")();\n";
}

function html_to_text (s) {
  var d = document.createElement('div');
  var l = s.split(/<br[^>]*>/);
  var r = [];
  for (var i = 0; i < l.length; i++) {
    if (! l[i].match(/^\s*$/)) {
      d.innerHTML = l[i];
      r.push(d.textContent);
    }
  }
  return r.join("\n");
}

function get_cookies () {
  var setting = {};
  var app_prefix = GM_ID + "_";
  var a = document.cookie.split("; ");
  for (var i = 0; i < a.length; i++) {
    var p = a[i].split("=");
    var name = p[0];
    var value = decodeURIComponent(p[1]);
    if (name.indexOf(app_prefix, 0) == 0) {
      name = name.substr(app_prefix.length);
      setting[name] = value;
    }
  }
  return setting;
}

function set_session_cookie (name, value) {
  var str;
  name = GM_ID + "_" + name;
  if (value) {
    str = name + "=" + encodeURIComponent(value);
  } else {
    str = name + "=";
  }
  var path =location.pathname;
  if (path.lastIndexOf("/") > 0) {
    path = path.substring(0, path.lastIndexOf("/") + 1);
  }
  str += "; path=" + path;
//  var expires = 365;
//  if (! value) {
//    expires = -1;
//  }
//  expires = new Date((new Date()).getTime() + expires * 60 * 60 * 24 * 1000);
//  str += "; expires=" + expires.toGMTString();
  document.cookie = str;
}

async function load_batch_data () {
  BATCH_DATA = JSON.parse(await GM.getValue(BATCH_DATA_ID, JSON.stringify({})));
  return;
}

async function save_batch_data () {
  await GM.setValue(BATCH_DATA_ID, JSON.stringify(BATCH_DATA));
}

function get_batch_data () {
  return BATCH_DATA;
}

function set_batch_data (json) {
  BATCH_DATA = json;
}

function get_aggregate_data () {
  var s = sessionStorage.getItem(AGGREGATE_DATA_ID);
  if (!s) return null;
  return JSON.parse(s);
}

function set_aggregate_data (json) {
  sessionStorage.setItem(AGGREGATE_DATA_ID, JSON.stringify(json));
}

function remove_aggregate_data (json) {
  sessionStorage.removeItem(AGGREGATE_DATA_ID);
}

function get_cocolog_stat_home () {
  var d = document.getElementById('topmenu');
  var l = d.getElementsByTagName('a');
  var h = "unknown";
  for (var i = 0; i < l.length; i++) {
    var a = l[i];
    if (a.target == "_blank") {
      h = a.href;
      break;
    }
  }
  return h;
}

function get_cocolog_stat_home_cms () {
  var d = document.getElementsByTagName('header')[0];
  var l = d.getElementsByTagName('a');
  var h = "unknown";
  for (var i = 0; i < l.length; i++) {
    var a = l[i];
    if (a.className == "induction-link") {
      h = a.href;
      break;
    }
  }
  return h;
}

function set_cocolog_stat_home (url, bid) {
  return url.replace(/\/[01-9]+\//, "/" + bid + "/").replace(/\#$/, "");
}

function set_url_batch_mode (url, mode_id) {
  var s = url;
  if (s.match(/([\?\&])batch_mode=[^\?\&]+/)) {
    var pre = RegExp.leftContext;
    var post = RegExp.rightContext;
    if (post != "") {
      pre = pre + RegExp.$1;
      post = post.substr(1);
    }
    s = pre + post;
  }
  s += (s.match(/\?/))? '&' : '?';
  s += "batch_mode=" + encodeURIComponent(mode_id);
  return s;
}

function unset_url_batch_mode (url) {
  var s = url;
  if (s.match(/([\?\&])batch_mode=[^\?\&]+/)) {
    var pre = RegExp.leftContext;
    var post = RegExp.rightContext;
    if (post != "") {
      pre = pre + RegExp.$1;
      post = post.substr(1);
    }
    s = pre + post;
  }
  return s;
}

function set_url_page_num (url, num) {
  var s = url;
  if (s.match(/([\?\&])p=[^\?\&]+/)) {
    var pre = RegExp.leftContext;
    var post = RegExp.rightContext;
    if (post != "") {
      pre = pre + RegExp.$1;
      post = post.substr(1);
    }
    s = pre + post;
  }
  s += (s.match(/\?/))? '&' : '?';
  s += "p=" + encodeURIComponent(num.toString());
  return s;
}

function get_url_page_num (url) {
  var s = url;
  if (s.match(/[\?\&]p=([^\?\&]+)/)) {
    return parseInt(RegExp.$1, 10);
  }
  return -1;
}

function is_cocolog_stat () {
  return location.href.match(/\/t\/app\/control\/stats(?:$|\?)/);
}

function is_cocolog_cms_stat () {
  return location.href.match(/\/cms\/.*\/access_analyze\//);
}

function is_simple_summary () {
  return location.href.match(/\/ua\/admin\/simple-summary\//);
}

function is_aggregatable () {
  return location.href.match(/\/(?:urls|keywords|referers\/ranking\/fqdn|referers\/ranking\/url)(?:$|\?)/);
}

function parse_error () {
  alert(GM_ID + ": Parse Error.");
  return null;
}


function initialize_batch_data () {
  var d, l;
  var json = {};
  set_batch_data(json);

  d = document.getElementById('accessAnalyze_select');
  l = d.options;
  var blogs = {};
  for (var i = 0; i < l.length; i++) {
    d = l[i];
    if (d.value) {
      blogs[d.value] = d.innerHTML;
    }
  }
  var h = get_cocolog_stat_home();
  if (! json["homes"]) {
    json["homes"] = {};
  }
  json.homes[h] = {};
  json.homes[h]["blogs"] = blogs;
  json.homes[h]["cocolog_stat"] = location.href;

  set_batch_data(json);
}

function initialize_batch_data_cms () {
  var d, l;
  var json = {};
  set_batch_data(json);

  d = document.getElementsByName('blog_id')[0];
  l = d.options;
  var blogs = {};
  for (var i = 0; i < l.length; i++) {
    d = l[i];
    if (d.value.match(/\/cms\/blogs\/([01-9]+)\//)) {
      blogs[RegExp.$1] = d.innerHTML;
    }
  }
  var h = get_cocolog_stat_home_cms();
  if (! json["homes"]) {
    json["homes"] = {};
  }
  json.homes[h] = {};
  json.homes[h]["blogs"] = blogs;
  json.homes[h]["cocolog_stat"] = location.href;

  set_batch_data(json);
}

function new_mode_id () {
  var i = 0;
  var json = get_batch_data();
  while (1) {
    var id = GM_ID + "_" + i.toString();
    if (! json[id]) {
      json[id] = {};
      set_batch_data(json);
      return id;
    }
    i++;
  }
}

function batch_mode_cocolog_stat (data) {
  var blog_id = data.blog_id;
  var mode_id = data.mode_id;
  var s = "";
  s += make_variable_injection("GM_ID", GM_ID);
  s += make_variable_injection("BATCH_MODE_ID", mode_id);
  s += make_variable_injection("BATCH_BLOG_ID", blog_id);
  s += make_code_injection(function () {
    TC.Client.call({
      uri: '/t/app/control/stats',
      method: 'POST',
      load: function(c, content) {
        var result = JSON.parse(content);
        if (result.iframe_url) {
          var s = result.iframe_url;
	  s += (s.match(/\?/))? '&' : '?';
	  s += 'batch_mode=' + encodeURIComponent(BATCH_MODE_ID);
	  location.href = s;
	} else {
	  alert(GM_ID + ": Failure.");
	}
      },
      error: function() {
	alert(GM_ID + ": Failure.");
      },
      arguments: {
        __mode: 'get_iframe_url',
        json: {
          "blog_id": BATCH_BLOG_ID
        }.toJSON()
      }
    });
  });
  var scr = document.createElement('script');
  scr.textContent = s;
  document.body.appendChild(scr);
  document.body.removeChild(scr);
}

function batch_mode_cocolog_cms_stat (data) {
  var blog_id = data.blog_id;
  var mode_id = data.mode_id;
  var s = document.getElementsByTagName('iframe')[0];
  s = s.src;
  s += (s.match(/\?/))? '&' : '?';
  s += 'batch_mode=' + encodeURIComponent(mode_id);
  location.href = s;
}

function batch_mode_ua_admin_aggregate_wait (resolve) {
  var d, l;
  d = document.getElementById('contentBody');
  l = d.getElementsByClassName('alert-warning');
  if (l.length > 0) {
    resolve(false);
    return;
  }
  l = d.getElementsByTagName('table');
  if (l.length == 0) {
    setTimeout(() => { batch_mode_ua_admin_aggregate_wait(resolve); },
	       1000);
  } else {
    resolve(true);
  }
}

function batch_mode_ua_admin_aggregate (mode_id) {
  (new Promise((resolve, reject) => {
    batch_mode_ua_admin_aggregate_wait(resolve);
  })).then((x) => {
    batch_mode_ua_admin_aggregate_main.call(this, mode_id);
  });
}

function batch_mode_ua_admin_aggregate_main (mode_id) {
  var mode_id = this.mode_id;
  var d, s, l;
  var json = get_batch_data();
  var mdata = json[mode_id];
  var adata = get_aggregate_data();

  d = document.getElementById('contentBody');
  l = d.getElementsByTagName('table');
  if (l.length >= 1) {
    if (l.length < 1) return parse_error();
    var tbl = l[0];
    l = tbl.getElementsByTagName('th');
    var tname = [];
    for (var i = 0; i < l.length; i++) {
      d = l[i];
      tname.push(html_to_text(d.innerHTML));
      if (d.colSpan) {
	for (var j = 1; j < parseInt(d.colSpan, 10); j++) {
	  tname.push("");
	}
      }
    }
    if (! adata['label']) {
      adata['label'] = tname;
    }
    l = tbl.getElementsByTagName('tbody');
    if (l.length < 1) return parse_error();
    var tr = l[0].getElementsByTagName('tr');
    for (var i = 0; i < tr.length; i++) {
      l = tr[i].getElementsByTagName('td');
      var r = [];
      for (var j = 0; j < l.length; j++) {
	s = html_to_text(l[j].innerHTML);
	r.push(s);
      }
      adata['tuples'].push(r);
    }
  }
  var page_max = ua_admin_page_max() || 1;
  if (mdata.page < page_max) {
    set_aggregate_data(adata);
    mdata.page++;
    json[mode_id] = mdata;
    set_batch_data(json);
    save_batch_data().then(() => {
      location.href = set_url_page_num(location.href, mdata.page);
    });
  } else if (adata.is_all && adata.blogs.length > 0) {
    mdata.blog_id = adata.blogs.shift();
    mdata.page = 1;
    set_aggregate_data(adata);
    json[mode_id] = mdata;
    set_batch_data(json);
    save_batch_data().then(() => {
      var s = set_cocolog_stat_home(json.homes[mdata.home].cocolog_stat, mdata.blog_id);
      location.href = set_url_batch_mode(s, mode_id);
    });
  } else {
    remove_aggregate_data();
    delete json[mode_id];
    set_batch_data(json);
    show_aggregate_result(mdata, adata);
    normal_mode_ua_admin();
  }
}

function batch_mode_main (mode_id) {
  var json = get_batch_data();
  var data;
  if (json && json[mode_id]) {
    data = json[mode_id];
  }
  if (! data) {
    alert(GM_ID + ": Batch Mode Failure!");
    return;
  }
  
  if (is_cocolog_stat()) {
    batch_mode_cocolog_stat(data);
    return;
  } else if (is_cocolog_cms_stat()) {
    batch_mode_cocolog_cms_stat(data);
    return;
  } else if (is_simple_summary()) {
    if (data.mode == "change_blog") {
      delete json[mode_id];
      set_batch_data(json);
      save_batch_data().then(() => {
	location.href = data.url;
      });
    } else {
      save_batch_data().then(() => {
	location.href = set_url_batch_mode(data.url, data.mode_id);
      });
    }
    return;
  } else {
//    batch_mode_ua_admin(mode_id);
    if (data.mode == "aggregate") {
      window.addEventListener("load", bind(batch_mode_ua_admin_aggregate,
					   {mode_id: mode_id}), false);
    }
    return;
  }
}

function cocolog_stat_show_all (e) {
  var d, l, s;
  d = document.getElementById(GM_ID + "_" + "show_all_container");
  var p = d.parentNode;
  p.removeChild(d);

  d = document.getElementById('accessAnalyze_select');
  l = d.options;
  var blogs = [];
  for (var i = 0; i < l.length; i++) {
    d = l[i];
    if (d.value) {
      blogs.push([d.value, d.innerHTML]);
    }
  }

  d = document.getElementById('content-area');
  var carea = d;
  var html = d.innerHTML;
  d = document.getElementById('not-available-message');
  var mes = d;
  
  for (var i = 0; i < blogs.length; i++) {
    var bid = blogs[i][0];
    var title = blogs[i][1];
    s = html;
    s = s.replace(/(\<[^\>\<]+\sid=[\"\'][^\"\']+)/ig, "$1_" + bid);
    s = s.replace(/(\<iframe[^\>\<]+)\ssrc=[\"\'][^\"\']*[\"\']/ig, "$1");
    s = s.replace(/(\<dt[^\>]+\>)[^<]+/i, "$1" + title);
    d = document.createElement(carea.tagName);
    d.id = carea.id + "_" + bid;
    d.style = carea.style;
    d.className = carea.className;
    d.innerHTML = s;
    mes.parentNode.insertBefore(d, mes);

    s = "";
    s += make_variable_injection("GM_ID", GM_ID);
    s += make_code_injection(function () {
      var mes = document.getElementById('not-available-message');
      TC.addClassName(mes, 'hidden');
    });
    d = document.createElement('script');
    d.textContent = s;
    document.body.appendChild(d);
    document.body.removeChild(d);

    s = "";
    s += make_variable_injection("BATCH_BLOG_ID", bid);
    s += make_code_injection(function () {
      var f = function (b) {
	TC.Client.call({
	  uri: '/t/app/control/stats',
	  method: 'POST',
	  load: function(c, content) {
            var result = JSON.parse(content);
	    var carea = document.getElementById('content-area_' + b);
	    var iframe = document.getElementById('accessAnalyze_iframe_' + b);
	    var atitle = document.getElementById('accessAnalyze_title_' + b);
	    var mes = document.getElementById('not-available-message');
            if (result.iframe_url) {
	      TC.removeClassName(carea, 'hidden');
	      iframe.src = result.iframe_url;
	      atitle.innerHTML = result.blog_title;
	    } else {
	      alert(GM_ID + ": Failure to load blog_id:" + b + ".");
	      TC.removeClassName(mes, 'hidden');
	    }
	  },
	  error: function() {
	    alert(GM_ID + ": Failure.");
	  },
	  arguments: {
            __mode: 'get_iframe_url',
            json: {
              "blog_id": b
            }.toJSON()
	  }
	});
      };
      f(BATCH_BLOG_ID);
    });
    var scr = document.createElement('script');
    scr.textContent = s;
    document.body.appendChild(scr);
    document.body.removeChild(scr);
  }
} 

function normal_mode_cocolog_stat () {
  var d, l;
  d = document.getElementById('accessAnalyze_select');
  while (d.tagName.toLowerCase() != "div") {
    d = d.parentNode;
  }
  var p = d;
  d = document.createElement('span');
  d.id = GM_ID + "_" + "show_all_container";
  d.className = GM_ID + "_" + "show_all_container";
  p.appendChild(d);
  p = d;
  d = document.createElement('input');
  d.type = 'button';
  d.value = 'Show All';
  d.id = GM_ID + "_" + "show_all";
  d.className = GM_ID + "_" + "show_all";
  p.appendChild(d);
  d.addEventListener('click', cocolog_stat_show_all, false);
}

function cocolog_cms_stat_show_all (e) {
  var d, l, s;
  d = document.getElementById(GM_ID + "_" + "show_all_container");
  var p = d.parentNode;
  p.removeChild(d);

  d = document.getElementsByName('blog_id')[0];
  l = d.options;
  var blogs = [];
  for (var i = 0; i < l.length; i++) {
    d = l[i];
    if (d.value.match(/\/cms\/blogs\/([01-9]+)\//)) {
      blogs.push([RegExp.$1, d.innerHTML]);
    }
  }

  d = document.getElementById('content-area');
  var carea = d;
  var html = d.innerHTML;
  d = document.getElementsByTagName('main')[0];
  d = d.getElementsByTagName('ul')[0]
  var mes = d;
  
  for (var i = 0; i < blogs.length; i++) {
    var bid = blogs[i][0];
    var title = blogs[i][1];
    s = html;
    s = s.replace(/(\<[^\>\<]+\sid=[\"\'][^\"\']+)/ig, "$1_" + bid);
    s = s.replace(/(\<iframe[^\>\<]+)\ssrc=[\"\'][^\"\']*[\"\']/ig, "$1");
    s = s.replace(/(\<dt[^\>]+\>)[^<]+/i, "$1" + title);
    d = document.createElement(carea.tagName);
    d.id = carea.id + "_" + bid;
    d.style = carea.style;
    d.className = carea.className;
    d.innerHTML = s;
    mes.parentNode.insertBefore(d, mes);
    var url = set_cocolog_stat_home(location.href, bid);

    GM.xmlHttpRequest({
      method: "GET",
      url: url,
      onload: bind(function (res) {
	var s = res.responseText;
	if (! s.match(/\<iframe([^\>]+)\>/)) {
	  console.log("parse error: " + this.url);
	  return;
	}
	s = RegExp.$1;
	if (! s.match(/src=\"([^\"]+)\"/)) {
	  console.log("parse error: " + this.url);
	  return;
	}
	var result = RegExp.$1;
	var carea = document.getElementById('content-area_' + this.bid);
	var iframe = document.getElementById('accessAnalyze_iframe_' + this.bid);
	var atitle = document.getElementById('accessAnalyze_title_' + this.bid);
	//TC.removeClassName(carea, 'hidden');
	iframe.src = result;
	atitle.innerHTML = this.title;
      }, {url: url, bid: bid, title: title})
    });
  }
} 

function normal_mode_cocolog_cms_stat () {
  var d, l;
  d = document.getElementsByName('blog_id')[0];
  while (d.tagName.toLowerCase() != "div") {
    d = d.parentNode;
  }
  var p = d;
  d = document.createElement('span');
  d.id = GM_ID + "_" + "show_all_container";
  d.className = GM_ID + "_" + "show_all_container";
  p.appendChild(d);
  p = d;
  d = document.createElement('input');
  d.type = 'button';
  d.value = 'Show All';
  d.id = GM_ID + "_" + "show_all";
  d.className = GM_ID + "_" + "show_all";
  p.appendChild(d);
  d.addEventListener('click', cocolog_cms_stat_show_all, false);
}


function ua_admin_select_blog (e) {
  var h = this.home;
  var d, l, s;
  var sel = e.target;
  d = sel.options[sel.selectedIndex];
  if (! d.value) return;
  var bid = d.value;
  var mid = new_mode_id();
  var url = location.href;
  if (get_url_page_num(url) != -1) {
    url = set_url_page_num(url, 1);
  }
  var data = {
    "mode_id" : mid,
    "mode": "change_blog",
    "url": url,
    "home": h,
    "blog_id": bid
  };
  var json = get_batch_data();
  json[mid] = data;
  set_batch_data(json);
  s = set_cocolog_stat_home(json.homes[h].cocolog_stat, bid);
  save_batch_data().then(() => {
    location.href = set_url_batch_mode(s, mid);
  });
}

function ua_admin_insert_blog_selector () {
  var d, l, s;
  var json = get_batch_data();
  d = document.getElementById('siteMenu');
  if (!d) return parse_error();

  l = d.getElementsByTagName('li');
  d = null;
  for (var i = 0; i < l.length; i++) {
    d = l[i];
    if (d.className == "site-name") {
      break;
    } else {
      d = null;
    }
  }
  if (! d) return parse_error();

  s = d.innerHTML;
  if (! s.match(/\<a/)) return parse_error();
  var pre = RegExp.leftContext;
  var post = RegExp.lastMatch + RegExp.rightContext;
  var a = d.getElementsByTagName('a')[0];
  var p = d;
  if (! pre.match(/(ID: [01-9]+\/)(.*)( \[)$/)) {
    return parse_error();
  }
  pre = RegExp.leftContext + RegExp.$1;
  post = RegExp.$3 + RegExp.rightContext + post;
  var title = RegExp.$2;
  p.innerHTML = pre + '<span id="blog-selector-holder"></span>' + post;
  p = document.getElementById("blog-selector-holder");
  var h;
  for (var k in json.homes) {
    if (k == a.href.substr(0, k.length)) {
      h = k;
    }
  }
  if (!h) return parse_error();
  var sel = document.createElement('select');
  sel.id = 'blog-selector';
  sel.className = 'blog-selector';
  sel.style.paddingTop = "0";
  sel.style.paddingBottom = "0";
  sel.style.margin = "0";
  sel.style.fontSize = "small";
  sel.style.height = "auto";
  sel.style.lineHeight = "1em";
  sel.style.width = "auto";
  d = document.createElement('option');
  d.value = "";
  d.innerHTML = title;
  d.selected = true;
  sel.appendChild(d);

  var blogs = json.homes[h].blogs;
  for (var k in blogs) {
    var v = blogs[k];
    d = document.createElement('option');
    d.value = (title == v)? "" : k;
    d.innerHTML = v;
    sel.appendChild(d);
  }
//  d = document.getElementById('settings');
//  d.parentNode.insertBefore(sel, d);
  p.appendChild(sel);
  sel.addEventListener('change', bind(ua_admin_select_blog, {home: h}), false);
  return {home: h, title: title};
}

function ua_admin_page_max () {
  var d, s, l;
  d = document.getElementById('contentBody');
  if (! d) return null;
  l = d.getElementsByTagName('div');
  d = null;
  for (var i = 0; i < l.length; i++) {
    if (l[i].className == 'pagination') {
      d = l[i];
      break;
    }
  }
  if (! d) return null;
  l = d.getElementsByTagName('a');
  var r = 0;
  for (var i = 0; i < l.length; i++) {
    s = l[i].textContent;
    if (s.match(/^\s*([01-9]+)\s*$/)) {
      var n = parseInt(RegExp.$1, 10);
      if (n > r) r = n;
    }
  }
  if (r == 0) r = null;
  return r;
}

var GREY_OVERLAY_CSS = '\
#grey-overlay {\
  position: fixed;\
  z-index: 2001;\
  top: 0px;\
  left: 0px;\
  height: 100%;\
  width: 100%;\
  background: black;\
  opacity: 0.8;\
  display: none;\
}\
\
#grey-overlay-form {\
  position: fixed;\
  z-index: 2002;\
  top: 10%;\
  left: 10%;\
  text-align: center;\
  opacity: 1.0;\
  width: 80%;\
  height: 80%;\
}\
\
#grey-overlay-form textarea {\
  width: 100%;\
  height: 100%;\
}\
\
#grey-overlay-form a {\
  background: white;\
  border: 1px solid black;\
  padding: 2px;\
  margin: 2px;\
}';


function popup_grey_overlay () {
  var d, s;
  d = document.getElementById("grey-overlay");
  if (! d) {
    add_style(GREY_OVERLAY_CSS);
    d = document.createElement("div");
    d.id = "grey-overlay";
    d.className = "grey-overlay";
    document.body.appendChild(d);
  }
  d.style.display = "block";
  d = document.getElementById("grey-overlay-form");
  if (! d) {
    d = document.createElement("form");
    d.id = "grey-overlay-form";
    document.body.appendChild(d);
//    var w = window.innerWidth;
//    var h = window.innerHeight;
//    d.style.top = "" + Math.floor(h * 0.1) + "px";
//    d.style.left = "" + Math.floor(w * 0.1) + "px";
  }
  d.style.display = "block";
}

function close_grey_overlay () {
  var f = document.getElementById("grey-overlay-form");
  if (f) {
    f.style.display = "none";
  }
  var d = document.getElementById("grey-overlay");
  if (d) {
    d.style.display = "none";
  }
  save_batch_data().then(() => {
    location.href = unset_url_batch_mode(location.href);
  });
}

function show_aggregate_result (mdata, adata) {
  var d, s, l;
  var text = "";
  var json = {};
  json["home"] = mdata["home"];
  json["blog"] = adata["blog"];
  json["title"] = adata["title"];
  json["tuples"] = adata["tuples"];
  if (adata["label"]) {
    json["label"] = adata["label"];
  }
  text += json.blog + ": " + json.title + "\n";
  var res = [];
  var typ = [];
  typ[0] = "str";
  for (var i = 0; i < json.tuples.length; i++) {
    var l = json.tuples[i];
    for (var j = 0; j < l.length; j++) {
      var s = l[j];
      var n = -1;
      if (s.match(/^[01-9]+$/)) {
	n = parseInt(s, 10);
      }
      if (i == 0) {
	res[j] = 0;
      }
      if (n >= 0 && typ[j] != "str") {
	typ[j] = "num";
      } else {
	typ[j] = "str";
      }
      if (typ[j] == "num") {
	res[j] += n;
      } else {
	res[j]++;
      }
    }
  }
  for (var i = 0; i < res.length; i++) {
    if (json.label[i]) {
      if (typ[i] == "str") {
	text += "全" + json.label[i] + "数=";
      } else {
	text += "全" + json.label[i] + "=";
      }
    }
    text += res[i];
    if (i != res.length - 1) {
      text += ", ";
    } else {
      text += "\n";
    }
  }
  var fname = "";
  if (location.href.match(/\/([^?\/]+)(?:$|[?])/)) {
    fname += RegExp.$1;
  } else {
    fname += "data";
  }
  if (location.href.match(/[\&\?]start=([^\&\?]+)/)) {
    fname += "_" + RegExp.$1;
  }
  fname += ".json";

  popup_grey_overlay();

  d = document.getElementById('grey-overlay-form');
  d.innerHTML = ''
    + '<textarea id="grey-overlay-textarea"></textarea><br/>\n'
    + '<a id="grey-overlay-download-button" href="" target="_blank">JSON でダウンロード</a>\n'
    + '<input type="button" id="grey-overlay-back-button" value="元の表示"/>\n'
  ;

  d = document.getElementById('grey-overlay-back-button');
  d.addEventListener('click', close_grey_overlay, false);

  d = document.getElementById("grey-overlay-textarea");
  d.value = text;

  d = document.getElementById("grey-overlay-download-button");
  s = new Blob([JSON.stringify(json)],
	       {type: 'application/json'});
  d.href = URL.createObjectURL(s);
  d.download = fname;
}

function ua_admin_aggregate (e) {
  var d, s, l;
  var is_all = this.all;
  var h = this.home;
  var blog_title = this.title;
  var adata = get_aggregate_data();
  if (adata) {
    if (! confirm(GM_ID + ": すでに集計が動いているか、直前に異常終了したようです。続行しますか？")) {
      return;
    }
  }
  var json = get_batch_data();
  var blogs = json.homes[h].blogs;
  adata = {};
  adata["is_all"] = is_all;
  adata["blog"] = (is_all)? "全ブログ" : blog_title;
  d = document.getElementById('pageTitle');
  s = d.innerHTML;
  s = s.replace(/\<div.*$/, "").replace(/^\s+/, "");
  adata["title"] = s;
  l = [];
  for (var k in blogs) {
    l.push(k);
  }
  adata["blogs"] = l;
  adata["tuples"] = [];
  
  var mid = new_mode_id();
  var mdata = {
    "mode_id" : mid,
    "mode": "aggregate",
    "page": 1,
    "url": set_url_page_num(location.href, 1),
    "home": h
  };
  var url;
  if (is_all) {
    mdata["blog_id"] = l.shift();
    url = set_cocolog_stat_home(json.homes[h].cocolog_stat, mdata["blog_id"]);
  } else {
    url = mdata.url;
  }
  json[mid] = mdata;

  set_batch_data(json);
  set_aggregate_data(adata);
  save_batch_data().then(() => {
    location.href = set_url_batch_mode(url, mid);
  });
}

function ua_admin_insert_aggregate_button (assoc) {
  var h = assoc.home;
  var title = assoc.title;
  var d, s, l;
  var p = document.getElementById('dateSwitcherBox');
  if (! p) return parse_error();
  d = document.createElement('div');
  d.id = "aggregate-button-holder";
  d.className = d.id;
  d.style.textAlign = 'right';
  s = "";
  s += '<input type="button" class="btn btn-middle" id="aggregate-button" value="集計"/>';
  s += '<input type="button" class="btn btn-middle" id="aggregate-all-button" value="全ブログ集計"/>';
  d.innerHTML = s;
  p.appendChild(d);
  d = document.getElementById("aggregate-button");
  d.addEventListener("click", bind(ua_admin_aggregate,
				   {home: h, title: title, all: false}),
		     false);
  d = document.getElementById("aggregate-all-button");
  d.addEventListener("click", bind(ua_admin_aggregate,
				   {home: h, title: title, all: true}),
		     false);
}

function normal_mode_ua_admin () {
  if (is_simple_summary()) return;
  var assoc = ua_admin_insert_blog_selector();
  if (! is_aggregatable()) return;
  ua_admin_insert_aggregate_button(assoc);
}

function normal_mode_main () {
  if (is_cocolog_stat()) {
    if (document.cookie) {
      var setting = get_cookies();
      if (! setting["invoked"]) {
	initialize_batch_data();
	set_session_cookie("invoked", "true");
      }
    }
    normal_mode_cocolog_stat();
    return;
  } else if (is_cocolog_cms_stat()) {
    if (document.cookie) {
      var setting = get_cookies();
      if (! setting["invoked"]) {
	initialize_batch_data_cms();
	set_session_cookie("invoked", "true");
      }
    }
    normal_mode_cocolog_cms_stat();
    return;
  } else {
    normal_mode_ua_admin();
    return;
  }
}

if (parent.window != window) {
  console = {
    log: function (s) {
      var d = document.createElement('div');
      d.textContent = s;
      document.body.appendChild(d);
    }
  };
}

//console.log("OK " + location.href);
if (parent.window == window) {
  load_batch_data().then(() => {
    if (location.href.match(/[\&\?]batch_mode=([^\&]+)/)) {
      batch_mode_main(decodeURIComponent(RegExp.$1));
    } else {
      normal_mode_main();
    }
  }).then(() => save_batch_data());
}
