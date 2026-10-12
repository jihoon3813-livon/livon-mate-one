var YT = YT || null, win;
if(typeof console=="undefined"){ console = { log : function(){}, info : function(){}, warn : function(){}, error : function(){} }; }
/* chart 기본설정 Start */
try{
  Chart.defaults.global.defaultFontSize = 12;
  Chart.defaults.global.defaultFontColor = '#333';
  Chart.defaults.global.defaultFontStyle = 'normal';
  Chart.defaults.global.defaultFontFamily = "'Noto Sans KR', sans-serif";
  Chart.defaults.global.tooltips.titleFontFamily = "'Noto Sans KR', sans-serif";
  Chart.defaults.global.tooltips.titleFontStyle = 'normal';
  Chart.defaults.global.tooltips.titleMarginBottom = 10;
  Chart.defaults.global.tooltips.bodyFontFamily = "'Noto Sans KR', sans-serif";
  Chart.defaults.global.tooltips.bodySpacing = 6;
  Chart.defaults.global.tooltips.xPadding = 20;
  Chart.defaults.global.tooltips.yPadding = 20;
  Chart.defaults.global.tooltips.caretPadding = 10;
  Chart.defaults.global.legend.display = false;
  Chart.defaults.global.elements.line.fill = false; //면일때 true
  Chart.defaults.global.elements.line.borderWidth = 2;
  Chart.defaults.global.elements.line.tension = 0;
  Chart.defaults.global.elements.arc.borderWidth = 0;
  Chart.defaults.global.tooltips.mode = "index";
  Chart.defaults.global.tooltips.intersect = false;
  Chart.defaults.global.hover.mode = "index";
  Chart.defaults.global.hover.intersect = false;
  Chart.defaults.global.hover.animationDuration = 50;
}catch(e){ }
/* chart 기본설정 End */

(function(global, ui){
  'use strict';

  win = { h : 0, w : 0, wrap : null, scrolltop : 0, scrollheight : 0, scrollleft : 0, scrolldir : "", size : {header:0, footer:0, headtop:0, fixhead:0, fixheadtop:0, foottop:0} };
  var _evt = {
    winclick : function(e){
      var target = e.target.nodeName==="A"||e.target.nodeName==="BUTTON" ? e.target : e.currentTarget, $target = $.$(target), $relele, uipop, blindtitle;
      uipop = target.getAttribute("data-uipop");
      blindtitle = target.getAttribute("data-blind-title");
      if(blindtitle) _page.blindtitle.call(target, blindtitle);
      document.focusEl = target;

      if($target.is("[data-anchor]")) anchorani.call(target, e);
      if(uipop){
        $relele = url2el(target, null);
        if(uipop==0 || uipop==1){
          if(!$relele) $relele = $target.closest('[data-uipopset]');
          if($relele.length==0) $relele = null;
          if(!$relele && !window.parent.length) self.close();
          if($relele && uipop==0) $relele.uipop("close");
          if($relele && uipop==1) $relele.uipop("open");
        }else if(uipop!="" && uipop!=undefined){
          var url = target.getAttribute("href") || target.getAttribute("data-url");
          var _data = $.extend([], $target.data("uipop"));
          _data.unshift(url);
          $target.uipop({winpop:_data});
        }
        e && e.preventDefault();
      }
    },
    winresize : function(e, first){
      var _oldWidth = win.w, _layout = _page.layout;
      win.h = window.innerHeight;
      win.w = window.innerWidth;
      win.scrollheight = document.body.scrollHeight;
      win.size.header = _layout.header.$obj?_layout.header.$obj.innerHeight():0;
      win.size.footer = _layout.footer.$obj?_layout.footer.$obj.innerHeight():0;
      if(_layout.header.$obj) _layout.pagesc.call(_layout);
    },
    winscroll : function(e, first){
      if(first && first==-1) win.scrolltop -= 1;
      var curscrolltop = _page.$win.scrollTop(), curscrollleft = _page.$win.scrollLeft(), _dir, _layout = _page.layout;
      _dir = win.scrolltop>curscrolltop ? "up" : "down";
      if(win.scrolldir!=_dir) _page.$body.replaceClass("(up|down)",_dir);
      win.scrolltop = curscrolltop;
      win.scrollleft = curscrollleft;
      win.scrolldir = _dir;
      if(_layout.header.$obj) _layout.pagesc.call(_layout);
    },
    doc : function($wrap){
      $wrap.findFilter("span[data-placeholder='true'], input[data-placeholder='true'], textarea[data-placeholder='true']").off('focus.placeholder blur.placeholder change.placeholder').on('focus.placeholder', function() { $.$(this).removeClass("placeholder"); }).on('blur.placeholder change.placeholder', function() {
        if(this.value||(this.nodeName=="SPAN"&&this.innerHTML.replace(/ */,"")!="")) $.$(this).removeClass("placeholder"); else $.$(this).addClass("placeholder");
      }).trigger('change.placeholder');
      var selectPlaceholder = function(){
        var $this = $.$(this);
        var isEqual = ($.trim($this.find("option").eq(this.selectedIndex).text()).toLowerCase()==$.trim(this.getAttribute("data-placeholder")).toLowerCase());
        if(isEqual) $this.addClass("placeholder");
        else $this.removeClass("placeholder");
      };
      $wrap.findFilter("select[data-placeholder]").each(selectPlaceholder).off("change.placeholder").on("change.placeholder", selectPlaceholder).trigger("change.placeholder");
      $wrap.findFilter("input[data-fakefile='file']").off('change.fakefile').on('change.fakefile', function() {
        var _ = this, _$ = $.$(_);
        _$.trigger('blur.delbtn');
        if($.trim(_.value)=="") _$.parent().removeClass("del-view"), _.$ipt && _.$ipt.val(""), _.$iptspan && _.$iptspan.html("");
        else _$.parent().addClass("del-view"), _.$ipt && _.$ipt.val(_.value.replace(/.*\\/,"")), _.$iptspan && _.$iptspan.html(_.value.replace(/.*\\/,""));
      }).trigger('change.fakefile').each(function(){
        var _ = this;
        _.$ipt = $.$(_).parent().find("input[data-fakefile='text']"); _.$iptspan = $.$(_).parent().find("span[data-fakefile='text']");
        _.$del = $.$(_).parent().find("[data-fakefile='del']");
        _.$del.off("click.delbtn").on("click.delbtn", function(e){ $.$(_).prop("value","").trigger("change.fakefile"); e.preventDefault(); });
      });
    },
    init : function($wrap, isReInit){
      var _ = this;
      if(!$wrap) $wrap = _page.$body;
      _.doc($wrap); //form event
      if(!isReInit){
        _page.$body.off("click.linkHandler").off("click.linkHandler", "a, button, area").on("click.linkHandler", "a, button, area", _.winclick).off("focus.appFocus blur.appFocus", "input:not([type='checkbox']):not([type='radio']),select,textarea");
        _page.$win.off("resize.layoutsc orientationChange.layoutsc").on("resize.layoutsc orientationChange.layoutsc", _.winresize).trigger("resize.layoutsc", true).off("scroll.layoutsc").on("scroll.layoutsc", _.winscroll).trigger("scroll.layoutsc");
        setTimeout(function(){ _page.$win.trigger("resize.layoutsc", true).trigger("scroll.layoutsc", true); }, 500);
      }else{
        _page.$win.trigger("resize.layoutsc", true).trigger("scroll.layoutsc", true);
      }
    }
  };
  var _page = {
    $win : $(window), $html : null, $body : null, wintitle : "", scrollcontroller : null, msg : {selected : "선택됨"},
    docTitle : function(doctitle){
      var _winTitle = [doctitle];
      $.each($("[data-addtitle]:visible"), function(){
        var t = this.getAttribute("data-addtitle");
        if(!t || t=="this"||t=="") t = $.$(this).text();
        _winTitle.push(t);
      });
      document.title = _winTitle.join(" > ");
    },
    blindtitle : function(blindid){
      if(!blindid) return;
      var blindtitleEle = document.getElementById(blindid);
      if(blindtitleEle){
        blindtitleEle.innerHTML = $.$(this).attr("title",_page.msg.selected).text();
        $('[data-blind-title="'+blindid+'"]').not(this).attr("title","");
      }
    },
    chart : {
      option : {
        timeFormat : "YYYY/MM/DD",
        bar : {
          //legend: {display: false},
          layout: {padding: {top: 27}},
          scales: {
            yAxes: [{
              stacked: false, position: 'right',
              gridLines: {drawTicks: false, drawBorder:false, borderDash: [4,2], zeroLineColor: "#000000", zeroLineWidth: 2}, //drawTicks : 참이면 차트 옆의 축 영역에서 눈금 옆에 선을 그립니다.
              ticks: {
                beginAtZero: true, padding:15, fontSize: 13, stepSize: 10, maxTicksLimit: 6,
                callback: function(value, index, values) { return value+"%"; }
              }
            }],
            xAxes: [{
              stacked: false,
              maxBarThickness: 100, barPercentage: 0.45,
              gridLines: {display: false},
              ticks: {fontSize: 15, padding: 9} //padding : 축에서 눈금 레이블의 오프셋을 설정합니다.
            }]
          }
        },
        pie : {
          tooltips: false,
          borderWidth:0,
          legend: {display: false},
          cutoutPercentage: 66.66
        }
      },
      dataurl : function(v){
        var _data, _option = this.option, _yaxes = false, _ticksSize = null;
        _data = v.data ? v.data : $.ajax({url: v.url, dataType: "json", async: false}).responseJSON;
        if(!_data) return [null, _yaxes];
        if(_data.datasets && _data.datasets.length){
          switch(v.case){ //차트별 색상지정
            case "bar" :
              var _single = _data.datasets.length, _max = [], _min = [];
              for(i in _data.datasets){
                _max.push( Math.max.apply(null, _data.datasets[i].data) );
                _min.push( Math.min.apply(null, _data.datasets[i].data) );
              }
              _max = Math.max.apply(null, _max);
              _min = Math.max.apply(null, _min);
              if(_max<=100 && _min >= 0){
                _ticksSize = {};
                _ticksSize.min = 0;
                _ticksSize.max = _max>50 ? 100 : 50;
                _ticksSize.stepSize = _ticksSize.max==100 ? 20 : 10;
              }
              break;
          }
        }else{
          _data = null;
        }
        return [_data, _yaxes, _ticksSize];
      },
      redraw : function(v){
        if(!v.case || !v.eleId || (!v.url && !v.data)) return;
        var _data, _el = document.getElementById(v.eleId), _chart, _w, _h;
        if(!_el) return;
        _chart = this, _w = _el.width, _h = _el.height;
        _data = ui.chart.dataurl({url:v.url,data:v.data,case:v.case,type:v.type||null,datacolor:v.datacolor||null,axeshide:v.axeshide||null});
        if(!_data || !_data[0]) return false;
        if(_el._chart) _el._chart.destroy();
        switch(v.case){
          case "bar" :
            var _newoption = _chart.option.bar;
            if(_data[2]){
              _newoption.scales.yAxes[0].ticks.min = _data[2].min;
              _newoption.scales.yAxes[0].ticks.max = _data[2].max;
              _newoption.scales.yAxes[0].ticks.stepSize = _data[2].stepSize;
            }
            if(v.responsive!=undefined) _newoption.responsive = v.responsive;
            _el._chart = new Chart(_el, {
              type: v.case,
              data: _data[0],
              options: _newoption
            });
            break;
          case "pie" :
          case "doughnut" :
            var _newoption = _chart.option.pie;
            if(v.responsive!=undefined) _newoption.responsive = v.responsive;
            _el._chart = new Chart(_el, {
              type: v.case,
              data: _data[0],
              options: _newoption
            });
            break;
        }
      }
    },
    grid : {
      range : {
        init : function(_this){
          var _ = this;
          $.$(_this).each(function(){
            var $cur = $.$(this), $amount = $cur.find(".amount");
            $cur.find(".bar").slider({ range:"min", min:_this.gridoption.min||1, max:_this.gridoption.max||7, step:_this.gridoption.step||0.1, value:_this.gridoption.value||1, slide:function( event, ui ){ $amount.val( ui.value ); } });
            $amount.prop("value", _this.gridoption.value||1);
          });
        }
      },
      init : function($wrap){
        if(!$wrap || $wrap.length==0) return;
        $.each($wrap, function(){
          var _this = this;
          _this.gridoption = $.$(_this).data("grid");
          console.log(_this.gridoption)
          if(_this.gridoption.case && _page.grid[_this.gridoption.case]) _page.grid[_this.gridoption.case].init(_this);
        });
      }
    },
    reInit : function($wrap){
      var _ = _page, isReInit = true;
      if(!_.$body) return;
      if(!$wrap) $wrap = _.$body, isReInit = false;
      if(win.h==0) win.h = _page.$win.height(), win.w = _page.$win.width(), win.scrollheight = document.body.scrollHeight;

      //_player.init($wrap); //youtube 플레이어 셋
      $wrap.findFilter('[data-calendar]').uicalendar(); // 캘린더
      $wrap.findFilter('[data-tab]').tab();
      $wrap.findFilter('[data-dropdown]').dropdown();
      _.grid.init($wrap.findFilter('[data-grid]'));
      swipeset.init($wrap.find('div[data-swipe]').not(".swipe-initialized")); //swipe tab
      setTimeout(function(){ $wrap.findFilter('dl[data-accordion], table[data-accordion], div[data-accordion], ul[data-accordion]').accordion(); }, 200);
      _evt.init($wrap, isReInit);
    },
    layout : {
      header : {
        $obj : null, $fixhead : null, timer : null, $lnb : null,
        init : function(){
          var _ = this;
          var $gnb = _.header.$obj.find(".gnb"), _count=0, _oldH, _outTimer; //.data("h",0);
          if(!$gnb.length) return false;
          var _open = function(_cur){
            var $p = $.$(this);
            clearTimeout(this.timer);
            $p.addClass("hover").find(".dep-2").fadeIn(100);
          }
          var _hide = function(notSub){
            var $p = $.$(this);
            clearTimeout(this.timer);
            if($p.find(":focus").length) return false;
            if(!notSub){
              $p.removeClass("hover").find(".dep-2").fadeOut(100);
            }
          }
          var _subhover = function(e){
            if(!e) return;
            var _cur = e.currentTarget;
            if(e.type=="mouseenter" || e.type=="focus" || e.type=="mouseover"){
              if(_cur._p.isSub) _open.call(_cur._p, _cur);
              else _hide.call(_cur._p, true);
              clearTimeout(_cur._p.timer);
            }else{
              _cur._p.timer = setTimeout(_hide.bind(_cur._p, _cur._p.isSub?false:true), 10);
            }
          }
          var _subetc = function(e){
            if(!e) return;
            if(e.type=="mouseenter" || e.type=="focus" || e.type=="mouseover"){
              clearTimeout(this._p.timer);
            }else{
              this._p.timer = setTimeout(_hide.bind(this._p, this._p.isSub?false:true), 10);
            }
          }
          $gnb.children().children("a").each(function(){
            this._p = this.parentNode;
            this._p.isSub = $.$(this._p).find(".dep-2").length;
            $.$(this._p).find(".dep-2").off("mouseenter.layoutgnb mouseleave.layoutgnb").on("mouseenter.layoutgnb", _subetc.bind(this)).on("mouseleave.layoutgnb", _subetc.bind(this))
              .find("a").off("focus.layoutgnb blur.layoutgnb").on("focus.layoutgnb", _subetc.bind(this)).on("blur.layoutgnb", _subetc.bind(this));
          }).off("mouseenter.layoutgnb focus.layoutgnb mouseleave.layoutgnb blur.layoutgnb").on("mouseenter.layoutgnb focus.layoutgnb", _subhover.bind(this)).on("mouseleave.layoutgnb blur.layoutgnb", _subhover.bind(this));

          _.header.$lnb = $(".lnb-wrap");
          if(_.header.$lnb.length) _.header.$lnb.data("dropdown",{"onlyclass":true, "acttit":".toggle", "actcont":"lnb-inner"}).dropdown();
          else _.header.$lnb = null;
        }
      },
      footer : {
        $obj : null
      },
      pagesc : function(e){
        var _layout = _page.layout, lnbgap = 0;

        if(_layout.header.$lnb){
          lnbgap = Math.max(_layout.header.$obj.height()-win.scrolltop, 0);
          _layout.header.$lnb.css({"padding-top":lnbgap+"px"});
          _layout.header.$lnb.children(".toggle").css({"top":lnbgap+"px"});
        }
      },
      init : function(){
        var _ = this;
        win.wrap = $("body > .wrap").get(0) || null;
        _.header.$obj = $("#header");
        if(!_.header.$obj.length) _.header.$obj = null;
        else _.header.init.call(_);
        _.footer.$obj = $("#footer");
        if(!_.footer.$obj.length) _.footer.$obj = null;
        win.size.header = _.header.$obj?_.header.$obj.innerHeight():0;
        win.size.footer = _.footer.$obj?_.footer.$obj.innerHeight():0;
        win.size.foottop = _.footer.$obj?_.footer.$obj.offset().top:0;
      }
    },
    init : function(){
      var _ = this;
      _.docTitle(document.title);
      _.layout.init();
      _.reInit();
    }
  };

  $(document).ready(function(){
    _page.$html= $("html");
    _page.$body = $("body");
    _page.init();
  });

  //public
  ui.reInit = _page.reInit;
  ui.chart = _page.chart;
  ui.loading = {
    $obj : null, objhtml : ['<div class="loading visible">','<div class="loading wrap-in visible">','<div class="ui-spinner"><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-blade"></div><div class="spinner-txt">Loading...</div></div></div>'],
    enable : function($wrap){
      if($wrap){
        var _wrap = $wrap.get(0);
        if(!_wrap.$loading){
          _wrap.$loading = $(this.objhtml[1]+this.objhtml[2]);
          $wrap.prepend(_wrap.$loading);
        }else{
          _wrap.$loading.addClass("visible");
        }
      }else{
        if(!this.$obj){
          this.$obj = $(this.objhtml[0]+this.objhtml[2]);
          $("body").prepend(this.$obj);
        }else{ this.$obj.addClass("visible"); }
      }
    },
    disable : function($wrap){
      if($wrap){
        var _wrap = $wrap.get(0);
        _wrap.$loading&&_wrap.$loading.removeClass("visible");
      }else{
        this.$obj&&this.$obj.removeClass("visible");
      }
    }
  };

})(this, this.ui = this.ui || {});