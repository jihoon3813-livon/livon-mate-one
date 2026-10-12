var CenterCommonHandler = {
    retryCount: 0,
    addressSettingComplete: function(fn, p){
    	var _this = this;
        var deferred = $.Deferred();
        var param = p || this.paramObject();
        var sidoElement = $("#sido");
        var sigunguElement = $("#sigungu");
        var organizationElement = $("#organization");
        var delay = 100;
        var maxRetryCount = 15;

        _setting(_this.retryCount);

        function _setting(retryCount){
            if(param.sido && sidoElement.length){
                if(retryCount < maxRetryCount
                    && !sidoElement.is(':disabled')
                    && sidoElement.find("option[value='" + param.sido + "']").length < 1){
                    return setTimeout(function(){_setting(++retryCount);}, delay);
                }
                if(sidoElement.find("option[value='" + param.sido + "']").length){
                    sidoElement.val(param.sido).change();
                }
         //        console.log("OK! SIDO: ", sidoElement.val(), sidoElement.get(0));
            }
            if(param.sigungu && sigunguElement.length){
                if(retryCount < maxRetryCount
                    && !sigunguElement.is(':disabled')
                    && sigunguElement.find("option[value='" + param.sigungu + "']").length < 1){
                    return setTimeout(function(){_setting(++retryCount);}, delay);
                }
                if(sigunguElement.find("option[value='" + param.sigungu + "']").length){
                    sigunguElement.val(param.sigungu).change();
                }
       //          console.log("OK! SIGUNGU: ", sigunguElement.val(), sigunguElement.get(0));
            }

            if(param.organization && organizationElement.length){
                if(retryCount < maxRetryCount
                    && !organizationElement.is(':disabled')
                    && organizationElement.find("option[value='" + param.organization + "']").length < 1){
                    return setTimeout(function(){_setting(++retryCount);}, delay);
                }
                if(organizationElement.find("option[value='" + param.organization + "']").length){
                    organizationElement.val(param.organization);
                }
        //         console.log("OK! ORGANIZATION: ", organizationElement.val(), organizationElement.get(0));
            }
            _this.retryCount = 0;
            var result = {success:'OK', addrParam:{
                sido: sidoElement.val(),
                sigungu: sigunguElement.val(),
                organization: organizationElement.val()
            }};
      //       console.log("result1111111112222   :",result);
            deferred.resolve(result);
            if($.isFunction(fn)){
                fn();
            }
        }
        return deferred.promise();
    },
    paramObject: function(){
        var b = {};
        if(window.location.search.indexOf('?') == 0){
            var a = window.location.search.substr(1).split('&');
            if (a == "") return {};
            for (var i = 0; i < a.length; ++i) {
                var p = a[i].split('=', 2);
                if (p.length == 1)
                    b[p[0]] = "";
                else
                    b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
        }
        return b;
    }
};