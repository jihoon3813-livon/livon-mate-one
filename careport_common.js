function CommonModule() {
    var args = Array.prototype.slice.call(arguments),
        callback = args.pop(),
        modules = (args[0] && typeof args[0] === 'string') ? args : args[0],
        i;

    if (!(this instanceof CommonModule)) {
        return new CommonModule(modules, callback);
    }

    if (!modules || modules === '*' || modules[0] === '*') {
        modules = [];
        for (var module in CommonModule.modules) {
            if (CommonModule.modules.hasOwnProperty(module)) {
                modules.push(module);
            }
        }
    }

    for (i = 0; i < modules.length; i+= 1) {
        CommonModule.modules[modules[i]](this);
    }

    callback(this);
}

CommonModule.prototype = {
    name: 'Common Module',
    description: 'Common JavaScript Module of Service & Platform Team at Hidea Solutions Co., Ltd.',
    version: '1.0.0',
    getName: function() {
        return this.name;
    },
    getDescription: function () {
        return this.description
    },
    getVersion: function() {
        return this.version;
    }
};

CommonModule.modules = {};

CommonModule.modules.utils = function(HIDEA) {
    HIDEA.popupAdminList = function() {
        window.open('/system/admin/popup', 'adminPop', 'width=800, height=600, menubar=no, status=no, toolbar=no, resizeable=no');
    };

    HIDEA.openPopCustomerSearch = function(targetCustomerId, targetCustomerName) {
        var param = {
            targetCustomerId: targetCustomerId || 'customerId',
            targetCustomerName: targetCustomerName || 'customerName'
        };

        var url = '/customer/popup' + CommonUtil.makeParamString(param);
        window.open(url, 'customerPop', 'width=1000, height=800, menubar=no, status=no, toolbar=no, resizeable=no');
    };

    HIDEA.fileDownload = function(baseFileId) {
        var downloadFormElm = document.createElement("form");
        downloadFormElm.setAttribute("id", "fileDownloadForm");
        downloadFormElm.setAttribute("action", "/fileDownload");
        downloadFormElm.setAttribute("method", "GET");
        downloadFormElm.setAttribute("target", "_SELF");

        var baseFileIdInput = document.createElement("input");
        baseFileIdInput.setAttribute("type", "hidden");
        baseFileIdInput.setAttribute("id", "baseFileId");
        baseFileIdInput.setAttribute("name", "baseFileId");
        baseFileIdInput.value = baseFileId;

        downloadFormElm.appendChild(baseFileIdInput);
        var body = document.getElementsByTagName("body")[0];
        body.appendChild(downloadFormElm);
        downloadFormElm.submit();

        downloadFormElm.remove();

    };

};

CommonModule.modules.commonUtils = function(HIDEA) {

    /**
     * Event가 발생한 Html 객체의 window 새로 위치 얻기
     */
    HIDEA.getRealOffsetTop = function(o) {
        return o ? o.offsetTop + this.getRealOffsetTop(o.offsetParent) : 0;
    };

    /**
     * Event가 발생한 Html 객체의 window 가로 위치 얻기
     */
    HIDEA.getRealOffsetLeft = function(o) {
        return o ? o.offsetLeft + this.getRealOffsetLeft(o.offsetParent) : 0;
    };

    /**
     * 게시판 첨부파일 사용시 선택한 파일 확장명 검사
     */
    HIDEA.attachInvalidCheck = function(name) {
        var target = null;
        if (document.getElementById(name) != null) {
            target = document.getElementById(name);
        } else if(eval("document."+name) != null) {
            target = eval("document."+name);
        } else if(document.all[name] != null) {
            target = document.all[name];
        }
        if (target != null) {
            if(target.value!=null && target.value.length>0){
                var invalid = ["ZIP","HWP","TXT","TEXT","PDF","DOC","RTF","PPT","XLS","AVI","WMV","WAV","WMA","ASF","MPG","MPEG","JPG","JPEG","GIF","BMP","PNG","SWF"];
                var isValid = false;
                for (var k=0 ; k < invalid.length ; k++) {
                    if (target != null && target.value.endsWith(invalid[k])) {
                        isValid = true;
                    }
                }
                return isValid;
            } else {
                return true;
            }
        }else{
            return true;
        }
    };

    /**
     * URL 파라미터 스트링을 만든다.
     *
     * @param obj {Key: Value} 형태의 Object
     * @returns String
     */
    HIDEA.makeParamString = function(obj) {
        var param = '';
        Object.keys(obj).forEach(function (key, idx) {
            param += (idx === 0 ? "?" : "&") + key + "=" + obj[key];
        });
        return param;
    };

    /**
     * URL 뒤에 쿼리 파라미터 스트링을 Object로 반환한다.
     *
     * @param search window.location.search로 추출한 쿼리 스트링
     * @return Object
     */
    HIDEA.decodeParamString = function(search) {
        var obj = {};
        var uri = decodeURI(search);
        uri = uri.slice(1, uri.length);

        var param = uri.split('&');

        for (var i = 0; i < param.length; i++) {
            var temp = param[i].split('=');
            obj[temp[0]] = temp[1];
        }

        return obj;
    };

    /**
     * 팝업리사이징
     */
    HIDEA.popupAutoResize = function() {
        var w = document.getElementsByTagName('div')[0].clientWidth + 25;
        var h = document.getElementsByTagName('div')[0].clientHeight + 25;
        window.resizeTo(w, h);

        var mw = window.outerWidth - window.innerWidth + 45;
        var mh = window.outerHeight - window.innerHeight + 45;
        window.resizeBy(mw, mh);

        var msIeVersion = this.msieversion();

        if (msIeVersion < 9 && msIeVersion  !== 0) {
            // get window fake outer size
            var fakeOuterWidth = document.documentElement.clientWidth;
            var fakeOuterHeight = document.documentElement.clientHeight;

            // resize to innerSize
            window.resizeTo(fakeOuterWidth, fakeOuterHeight);

            // get window fake inner size
            var fakeInnerWidth = document.documentElement.clientWidth;
            var fakeInnerHeight = document.documentElement.clientHeight;

            // get delta
            var deltaWidth = fakeOuterWidth - fakeInnerWidth + 45;
            var deltaHeight = fakeOuterHeight - fakeInnerHeight + 45;
            window.resizeTo(w + deltaWidth, h + deltaHeight);
        }
    };

    /**
     * 익스버전체크
     *
     * @returns {number} msie String index
     */
    HIDEA.msieversion = function() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf ( "MSIE " );
        if ( msie > 0 ) {
            return parseInt(ua.substring (msie+5, ua.indexOf (".", msie )))
        } else {
            return 0
        }
    };

    /**
     * IE 브라우저 여부 확인 함수
     *
     * @returns {boolean} IE 일 경우 TRUE, 아닐 경우 FALSE
     */
    HIDEA.isInternetExplorerBrowser = function() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");
        return msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./);
    }
};

CommonModule.modules.formUtils = function(HIDEA) {

    /**
     * Form 유효성 검사 공통 Function
     * 유효성 검사 대상은 required attribute가 존재 또는 true 이어야 한다.
     *
     * @param form
     * @returns {boolean}
     */
    HIDEA.comFormValidation = function(form, password, passwordConfirm) {
        var requiredFields = form.querySelectorAll('[required]');
        var passwordField;
        var passwordConfirmField;

        if (password == null) {
            passwordField = document.getElementById('password');
        }

        if (passwordConfirm == null) {
            passwordConfirmField = document.getElementById('passwordConfirm');
        }

        if (!passwordConfirm == null) {
            if (passwordField.classList.contains('is-invalid')) {
                passwordField.classList.remove('is-invalid');
            }

            if (passwordConfirmField.classList.contains('is-invalid')) {
                passwordConfirmField.classList.remove('is-invalid');
            }
            if (!CommonUtil.isValueEquals(passwordField.value, passwordConfirmField.value)) {
                CommonUtil.createInvalidInputDiv(form, passwordField, '비밀번호 확인과 맞지 않습니다.');
            }
        }


        var ret = true;
        var firstField = null;

        for (var i = 0; i < requiredFields.length; i++) {
            var field = requiredFields[i];

            if (field.classList.contains('is-invalid')) {
                field.classList.remove('is-invalid');
            }

            if (field.value.isEmpty()) {
                if (firstField == null) {
                    firstField = field;
                }

                CommonUtil.createInvalidInputDiv(field, field.title + ' 입력 필수');

                ret = false;
            }

        }

        if (firstField != null) {
            firstField.focus();
        }

        return ret;
    };

    /**
     * 유효성 검사 메시지 div 생성
     *
     * @param field input field
     * @param message 유효성 검사 메시지
     */
    HIDEA.createInvalidInputDiv = function(field, message) {

        if (!field.classList.contains('is-invalid')) {
            field.classList.add('is-invalid');
        }

        if (!field.nextElementSibling) {
            CommonUtil.insertInvalidFeedback(field, message);
        } else {
            var lastChild = field.parentNode.lastElementChild;
            if (lastChild.classList.contains('invalid-feedback')) {
                lastChild.innerHTML = message;
            } else {
                CommonUtil.insertInvalidFeedback(field, message);
            }
        }
    };

    HIDEA.isValueEquals = function(val1, val2) {
      return val1 === val2;
    };

    /**
     * 유효성 검사 메시지 삽입
     *
     * @param field input field
     * @param message 유효성 검사 메시지지     */
    HIDEA.insertInvalidFeedback = function(field, message) {
        var newDiv = document.createElement("div");
        newDiv.classList.add('invalid-feedback');
        newDiv.innerHTML = message;
        field.parentNode.appendChild(newDiv);
    };

    /**
     * 유효성 검사 메시지 삭제
     *
     * @param field
     */
    HIDEA.deleteInvalid = function(field) {
        field.classList.remove('is-invalid');
        if (field.nextElementSibling) {
            var lastChild = field.parentNode.lastElementChild;
            if (lastChild.classList.contains('invalid-feedback')) {
                lastChild.innerHTML = '';
            }
        }
    }

    /**
     * Form Submit을 하기 위한 공통 Function
     *
     * @param form
     * @param action
     * @param isSubmit
     * @param target
     * @param method
     */
    HIDEA.comFormProcess = function(form, action, isSubmit, target, method) {

        if (action != null) {
            form.action = action;
        }

        if (isSubmit == null) {
            isSubmit = true;
        }

        if (target != null) {
            form.target = target;
        }

        if (method != null) {
            form.method = method;
        }

        if (isSubmit === true) {
            form.submit();
        }
    };
};

CommonModule.modules.dateUtils = function(HIDEA) {
    
    /**
     * 유효한(존재하는) 월(月)인지 체크
     */
    HIDEA.isValidMonth = function(mm) {
        var m = parseInt(mm, 10);
        return (m >= 1 && m <= 12);
    };
    
    /**
     * 유효한(존재하는) 일(日)인지 체크
     */
    HIDEA.isValidDay = function(yyyy, mm, dd) {
        var m = parseInt(mm,10) - 1;
        var d = parseInt(dd,10);

        var end = [31,28,31,30,31,30,31,31,30,31,30,31];
        if ((yyyy % 4 === 0 && yyyy % 100 !== 0) || yyyy % 400 === 0) {
            end[1] = 29;
        }

        return (d >= 1 && d <= end[m]);
    };

    /**
     * 유효한(존재하는) 시(時)인지 체크
     */
    HIDEA.isValidHour = function(hh) {
        var h = parseInt(hh,10);
        return (h >= 1 && h <= 24);
    };

    /**
     * 유효한(존재하는) 분(分)인지 체크
     */
    HIDEA.isValidMin = function(mi) {
        var m = parseInt(mi,10);
        return (m >= 1 && m <= 60);
    };

    /**
     * Time 형식인지 체크(느슨한 체크)
     */
    HIDEA.isValidTimeFormat = function (time) {
        return (!isNaN(time) && time.length === 12);
    };

    /**
     * 유효하는(존재하는) Time 인지 체크
     */
    HIDEA.isValidTime = function(time) {
        var year  = time.substring(0,4);
        var month = time.substring(4,6);
        var day   = time.substring(6,8);
        var hour  = time.substring(8,10);
        var min   = time.substring(10,12);

        return !!(parseInt(year, 10) >= 1900 && this.isValidMonth(month) &&
            this.isValidDay(year, month, day) && this.isValidHour(hour) &&
            this.isValidMin(min));
    };

    /**
     * Time 스트링을 자바스크립트 Date 객체로 변환
     * parameter time: Time 형식의 String
     */
    HIDEA.toTimeObject = function(time) { //parseTime(time)
        var year  = time.substr(0,4);
        var month = time.substr(4,2) - 1; // 1월=0,12월=11
        var day   = time.substr(6,2);
        var hour  = time.substr(8,2);
        var min   = time.substr(10,2);

        return new Date(year, month, day, hour, min);
    };

    /**
     * 자바스크립트 Date 객체를 Time 스트링으로 변환
     * parameter date: JavaScript Date Object
     */
    HIDEA.toTimeString = function(date) { //formatTime(date)
        var year  = date.getFullYear();
        var month = date.getMonth() + 1; // 1월=0,12월=11이므로 1 더함
        var day   = date.getDate();
        var hour  = date.getHours();
        var min   = date.getMinutes();

        if (("" + month).length === 1) { month = "0" + month; }
        if (("" + day).length   === 1) { day   = "0" + day;   }
        if (("" + hour).length  === 1) { hour  = "0" + hour;  }
        if (("" + min).length   === 1) { min   = "0" + min;   }

        return ("" + year + month + day + hour + min)
    };

    /**
     * Time이 현재시각 이후(미래)인지 체크
     */
    HIDEA.isFutureTime = function(time) {
        return (this.toTimeObject(time) > new Date());
    };

    /**
     * Time이 현재시각 이전(과거)인지 체크
     */
    HIDEA.isPastTime = function(time) {
        return (this.toTimeObject(time) < new Date());
    };

    /**
     * 주어진 Time 과 y년 m월 d일 h시 차이나는 Time을 리턴

     * ex) var time = form.time.value; //'20000101000'
     *     alert(shiftTime(time,0,0,-100,0));
     *     => 2000/01/01 00:00 으로부터 100일 전 Time
     */
    HIDEA.shiftTime = function(time,y,m,d,h) { //moveTime(time,y,m,d,h)
        var date = this.toTimeObject(time);

        date.setFullYear(date.getFullYear() + y); //y년을 더함
        date.setMonth(date.getMonth() + m);       //m월을 더함
        date.setDate(date.getDate() + d);         //d일을 더함
        date.setHours(date.getHours() + h);       //h시를 더함

        return this.toTimeString(date);
    };

    /**
     * 두 Time이 몇 개월 차이나는지 구함

     * time1이 time2보다 크면(미래면) minus(-)
     */
    HIDEA.getMonthInterval = function(time1,time2) { //measureMonthInterval(time1,time2)
        var date1 = this.toTimeObject(time1);
        var date2 = this.toTimeObject(time2);

        var years  = date2.getFullYear() - date1.getFullYear();
        var months = date2.getMonth() - date1.getMonth();
        var days   = date2.getDate() - date1.getDate();

        return (years * 12 + months + (days >= 0 ? 0 : -1) );
    };

    /**
     * 두 Time이 며칠 차이나는지 구함
     * time1이 time2보다 크면(미래면) minus(-)
     */
    HIDEA.getDayInterval = function(time1,time2) {
        var date1 = this.toTimeObject(time1);
        var date2 = this.toTimeObject(time2);
        var day   = 1000 * 3600 * 24; //24시간

        return parseInt((date2 - date1) / day, 10);
    };

    /**
     * 두 Time이 몇 시간 차이나는지 구함

     * time1이 time2보다 크면(미래면) minus(-)
     */
    HIDEA.getHourInterval = function(time1,time2) {
        var date1 = this.toTimeObject(time1);
        var date2 = this.toTimeObject(time2);
        var hour  = 1000 * 3600; //1시간

        return parseInt((date2 - date1) / hour, 10);
    };

    /**
     * 현재 시각을 Time 형식으로 리턴
     */
    HIDEA.getCurrentTime = function() {
        return this.toTimeString(new Date());
    };

    /**
     * 현재 시각과 y년 m월 d일 h시 차이나는 Time을 리턴
     */
    HIDEA.getRelativeTime = function(y,m,d,h) {
        return this.shiftTime(this.getCurrentTime(),y,m,d,h);
    };

    /**
     * 현재 年을 YYYY형식으로 리턴
     */
    HIDEA.getYear = function() {
        return this.getCurrentTime().substr(0,4);
    };

    /**
     * 현재 月을 MM형식으로 리턴
     */
    HIDEA.getMonth = function() {
        return this.getCurrentTime().substr(4,2);
    };

    /**
     * 현재 日을 DD형식으로 리턴
     */
    HIDEA.getDay = function() {
        return this.getCurrentTime().substr(6,2);
    };

    /**
     * 현재 時를 HH형식으로 리턴
     */
    HIDEA.getHour = function() {
        return this.getCurrentTime().substr(8,2);
    };

    /**
     * 오늘이 무슨 요일이야?

     * ex) alert('오늘은 ' + getDayOfWeek() + '요일입니다.');
     * 특정 날짜의 요일을 구하려면? => 여러분이 직접 만들어 보세요.
     */
    HIDEA.getDayOfWeek = function() {
        var now = new Date();

        var day = now.getDay(); //일요일=0,월요일=1,...,토요일=6
        var week = ['일','월','화','수','목','금','토'];

        return week[day];
    };

    HIDEA.getFullDate = function() {
        return this.getCurrentTime().substr(0,8);
    };

    HIDEA.weekNo = function(dt) {
        var tdt = new Date(dt.valueOf());
        var dayn = (dt.getDay() + 6) % 7;
        tdt.setDate(tdt.getDate() - dayn + 3);
        var firstThursday = tdt.valueOf();
        tdt.setMonth(0, 1);
        if (tdt.getDay() !== 4) {
            tdt.setMonth(0, 1 + ((4 - tdt.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - tdt) / 604800000);
    };

    HIDEA.dateAdd = function(sDate, nDays) {
        var yy = Number(sDate.substring(0, 4));
        var mm = Number(sDate.substring(4, 6));
        var dd = Number(sDate.substring(6,8));

        d = new Date(yy, mm - 1, dd + nDays);

        yy = d.getFullYear();
        mm = d.getMonth() + 1; mm = (mm < 10) ? '0' + mm : mm;
        dd = d.getDate(); dd = (dd < 10) ? '0' + dd : dd;

        return '' + yy + '' +  mm  + '' + dd;
    };

    /**
     * 초를 시간 분으로 변경
     */
    HIDEA.secToTime = function(seconds) {
        var pad = function(x) { return (x < 10) ? "0"+x : x; };
        return pad(parseInt(seconds / (60*60))) + ":" +
            pad(parseInt(seconds / 60 % 60)) + ":" +
            pad(seconds % 60)
    };

    /**
     * 해당월 주의 최대값
     * @param dateStr       YYYYMM
     */
    HIDEA.getWeekCountOfMonth = function(dateStr) {
        var year  = Number(dateStr.substring(0, 4));
        var month = Number(dateStr.substring(4, 6));

        var nowDate = new Date(year, month-1, 1);

        var lastDate = new Date(year, month, 0).getDate();
        var monthSWeek = nowDate.getDay();

        var weekSeq = parseInt((parseInt(lastDate) + monthSWeek - 1)/7) + 1;

        return weekSeq;
    };

    /**
     * 초를받아 시:분:초 로변환
     */
    HIDEA.secToTimeFormat = function (seconds) {
        var pad = function(x) { return (x < 10) ? "0"+x : x; };
        return pad(parseInt(seconds / (60*60))) + ":" +
            pad(parseInt(seconds / 60 % 60)) + ":" +
            pad(seconds % 60)
    };

    /**
     * 두개의 HHmmss가 몇초인지 환산 후 차이계산
     * @param fullTime1
     * @param fullTime2
     * @returns {number}
     */
    HIDEA.fullTimeToSecDiff = function(fullTime1, fullTime2){
        var hourSec1 = Number(fullTime1.substring(0,2))*3600;
        var minSec1 = Number(fullTime1.substring(2,4))*60;
        var sec1 = Number(fullTime1.substring(4,6));
        var tmpFullTime1 = hourSec1+minSec1+sec1;

        var hourSec2 = Number(fullTime2.substring(0,2))*3600;
        var minSec2 = Number(fullTime2.substring(2,4))*60;
        var sec2 = Number(fullTime2.substring(4,6));
        var tmpFullTime2 = hourSec2+minSec2+sec2;
        return tmpFullTime1-tmpFullTime2;
    };

    HIDEA.getCurrentTimeSec = function() {
        return this.toTimeStringSec(new Date());
    };

    HIDEA.toTimeStringSec = function(date) {
        var year  = date.getFullYear();
        var month = date.getMonth() + 1; // 1월=0,12월=11이므로 1 더함
        var day   = date.getDate();
        var hour  = date.getHours();
        var min   = date.getMinutes();
        var sec   = date.getSeconds();

        if (("" + month).length === 1) { month = "0" + month; }
        if (("" + day).length   === 1) { day   = "0" + day;   }
        if (("" + hour).length  === 1) { hour  = "0" + hour;  }
        if (("" + min).length   === 1) { min   = "0" + min;   }
        if (("" + sec).length   === 1) { sec   = "0" + sec;   }

        return ("" + year + month + day + hour + min + sec)
    };
};

CommonModule.modules.checkUtils = function(HIDEA) {

    /**
     * 비밀번호 검사
     *
     * @param value 비밀번호
     * @returns {boolean} 검사결과과
    */
    HIDEA.isPassword = function(value){
        if (!this.pswdPtrn(value)){
            return false;
        }
        if (value.length > 16){
            return false;
        }
        return value.length >= 6;

    };

    /**
     * 정규식으로 문자열중 주민등록 번호 패턴 검사
     */
    HIDEA.textInRegistCode = function(str) {
        var format = "[0-9]{6}(-|.|)[1|2|3|4]{1}[0-9]{6}";
        return str.search(format) !== -1;
    };

    /**
     * 문자열에 한글문자가 하나라도 있는지 검사
     */
    HIDEA.strInKrChar = function(value) {
        for (var nindex = 0; nindex < value.length; nindex++) {
            var str2 = value.charAt(nindex);
            if ((str2 >= 'ㄱ' && str2 <= '힣')) {
                return true;
            }
        }
        return false;
    };

    /**
     * 정규식으로 문자열이 영문 대소 문자와 숫자로만 구성됬는지 패턴검사
     */
    HIDEA.strInNumNEn = function(value) {
        if (value==null || value.length < 1) return true;
        var temp = value;
        while (temp.indexOf("\\") >- 1) {
            temp = temp.substr(temp.indexOf("\\")+1);
        }
        temp = temp.replace("[","");
        temp = temp.replace("]","");
        var format = "[^\._A-Za-z0-9]{1,}";

        return temp.search(format) !== -1;
    };

    /**
     * 정규식으로 문자열이 영문 대소 문자와 숫자로만 구성됬는지 패턴검사
     */
    HIDEA.pswdPtrn = function(value) {
        var reg_pwd = /^.*(?=.{6,16})(?=.*[0-9])(?=.*[a-zA-Z]).*$/;
        return reg_pwd.test(value);
    };

    /**
     * 숫자인지 판단
     *
     * @param value
     * @returns {boolean}
     */
    HIDEA.isNumeric = function(value) {
        return !isNaN(value - parseFloat(value));
    };

    /**
     * 정규식으로 문자열이 이메일로 유효한지 패턴검사
     */
    HIDEA.isEmail = function(value) {
        var format = "^([-.0-9a-zA-Z]+)@([-.0-9a-zA-Z]+).([a-zA-Z]+)$";
        return value.search(format) !== -1;
    };

    /**
     * 정규식으로 문자열이 일반전화번호로 유효한지 패턴검사
     */
    HIDEA.isTelNumber = function(value) {
        var format = "^[0-9]\{2,3\}[0-9]\{3,4\}[0-9]\{4\}$";
        return value.search(format) !== -1;
    };

    /**
     * 정규식으로 문자열이 헨드폰번호로 유효한지 패턴검사
     */
    HIDEA.isMobileNumber = function(value) {
        var format = "^[0-9]\{3\}-[0-9]\{3,4\}-[0-9]\{4\}$";
        return value.search(format) !== -1;
    };

    /**
     * 정규식으로 문자열에 HTML Tag가 있는지 패턴검사
     */
    HIDEA.isHtmlInStr = function(value) {
        var temp = value;
        var format = "<*[0-9a-zA-Z]*>";

        temp = temp.replace("<","<").replace(">", ">");

        return temp.search(format) !== -1;
    };

    /**
     * 정규식으로 Element Value에 HTML SCRIPT TAG가 있는지 패턴검사
     */
    HIDEA.isScriptHtmlInElm = function(name) {
        var temp;
        var target = null;
        var format = "<*[[Ss][Cc][Rr][Ii][Pp][Tt]]*>";

        if (document.getElementById(name) != null) {
            target = document.getElementById(name);
        } else if (eval("document."+name) != null) {
            target = eval("document."+name);
        } else if(document.all[name] != null) {
            target = document.all[name];
        }
        if (target == null) {
            return false;
        }

        temp = target.value.replace("<","<").replace(">",">");
        return temp.value.search(format) !== -1;
    };
};

CommonModule.modules.stringUtils = function(HIDEA) {

    var original, sentence, parseKey, accessPoint, tokens;

    HIDEA.init = function(str, key) {
        original = str;
        sentence = str;
        parseKey = key;
        accessPoint = 0;
        tokens = sentence.split(parseKey);
    };

    HIDEA.hasMoreTokens = function() {
        return tokens.length > accessPoint;
    };

    HIDEA.nextToken = function() {
        if (this.hasMoreTokens()) {
            accessPoint++;
            return tokens[accessPoint-1];
        } else {
            return null;
        }
    };

    /**
     * 금액 문자열 포맷팅
     * @param strNumber 금액 문자열
     * @param mode 구분자 삽입 또는 삭제 코드
     * @returns {string} 포맷팅된 문자열
     */
    HIDEA.formatMoney = function(strNumber, mode) {
        var hasSign = false;
        var i = 0;
        var strResult = '';

        if (typeof strNumber !== 'string') {
            strNumber = String(strNumber);
        }
        var sign = strNumber.substring(0, 1);
        if (sign === '-' || sign === '+') {
            hasSign = true;
            strNumber = strNumber.substring(1);
        }

        var nLength = strNumber.length;

        if (mode === 'INSERT' || mode == null) {
            var j = 0;
            for (i = nLength - 1; i >= 0; i--) {
                j++;
                strResult = strNumber.substring(i, i + 1) + strResult;
                if (j % 3 === 0 && i > 0) {
                    strResult = ',' + strResult;
                }
            }
        } else if (mode === 'DELETE') {
            for (i = nLength - 1; i >= 0; i--) {
                if (strNumber.substring(i, i + 1) !== ',') {
                    strResult = strNumber.substring(i, i + 1) + strResult;
                }
            }
        }

        return hasSign ? sign + strResult : strResult;
    };

    /**
     * 인자 number가 10 미만일 경우 0을 붙여준다.
     *
     * @param number
     * @returns {string}
     */
    HIDEA.numberFormatTwoDigit = function(number) {
        return (number < 10 ? '0' : '') + number;
    };

    /**
     * 전화번호 문자열을 '-' 를 포함하여 변환한다.
     *
     * @param str 전화번호 문자열
     * @returns {string} 변환된 문자열 (xxx-xxxx-xxxx)
     */
    HIDEA.formatTelNumber = function(str) {
        var ret = '';
        var regex = "^(\\d{2,3})(\\d{3,4})(\\d{4,})";
        var retArr = String(str).match(regex);

        for (var i=1; i < retArr.length; i++) {
            ret += i !== retArr.length - 1 ? retArr[i] + '-' : retArr[i];
        }
        return ret;
    };

    /**
     * 날짜 문자열에 기호를 삽입한다.
     * 문자열 길이가 8자 (yyyymmdd) 일 경우와 (mmdd) 일 경우
     *
     * @param strDate 날짜문자열
     * @param sign 기호
     * @returns {string} 변환된 날짜 문자열
     */
    HIDEA.replaceFormat = function(strDate, sign){
        var tmpDate = "";
        if (strDate.length === 8) {
            tmpDate = [strDate.slice(0, 4), sign, strDate.slice(4, 6), sign, strDate.slice(6, 8)].join('');
        } else if(strDate.length === 4) {
            tmpDate = [strDate.slice(0, 2), sign, strDate.slice(2, 4)].join('');
        }
        return tmpDate;
    };
};

CommonModule.modules.excelUtil = function(HIDEA) {
    HIDEA.parseExcelFileNameFromContentDisposition = function(request) {
        var fileName = "excel";
        var extension = ".xls";
        var disposition = request.getResponseHeader('Content-Disposition');
        if (disposition && disposition.indexOf('attachment') !== -1) {
            var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            var matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) fileName = matches[1].replace(/['"]/g, '');
        }

        if (fileName.indexOf("UTF-8") > -1) {
            fileName = fileName.substring(fileName.indexOf("UTF-8")+5);
        }

        var decodeFileName = decodeURI(fileName) || '';
        if(decodeFileName.length > 4 && decodeFileName.indexOf(extension) >= decodeFileName.length - 5){
            return decodeFileName;
        }
        return decodeFileName + extension;
    };

    HIDEA.parseFileNameFromContentDisposition = function(request) {
        var fileName;
        var disposition = request.getResponseHeader('Content-Disposition');
        if (disposition && disposition.indexOf('attachment') !== -1) {
            var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            var matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) fileName = matches[1].replace(/['"]/g, '');
        }

        if (fileName.indexOf("UTF-8") > -1) {
            fileName = fileName.substring(fileName.indexOf("UTF-8")+5);
        }

        return decodeURI(fileName);
    };

    HIDEA.downloadExcelFromBlob = function(blobData, request) {
        var fileName = this.parseExcelFileNameFromContentDisposition(request);
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blobData, fileName);
        } else {
            var downloadUrl = URL.createObjectURL(blobData);
            var downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    HIDEA.downloadFromBlob = function(blobData, request) {
        var fileName = this.parseFileNameFromContentDisposition(request)
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blobData, fileName);
        } else {
            var downloadUrl = URL.createObjectURL(blobData);
            var downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    HIDEA.renderPdf = function(fileUrl) {
        var pdfViewerUrl;
        if (CommonUtil.isInternetExplorerBrowser()) {
            pdfViewerUrl = '/public/pdf/es5/web/viewer.html?file=';
        } else {
            pdfViewerUrl = '/public/pdf/web/viewer.html?file=';
        }

        var requestUrl = pdfViewerUrl + fileUrl;
        var pdfIframe = document.getElementById('pdf-iframe');
        pdfIframe.setAttribute('src', requestUrl);
        pdfIframe.style.display = 'block';
    };

};

CommonModule.modules.libraryUtil = function(HIDEA) {

    var isAllowSpannerOff = false;

    HIDEA.bootstrapNotifySuccess = function(message) {
        $.notify({
            message: message
        }, {
            // settings
            type: 'success',
            allow_dismiss: true,
            placement: {
                from: 'top',
                align: 'right'
            },
            offset: 40,
            spacing: 10,
            z_index: 13000,
            delay: 2500,
            timer: 1000
        })
    };

    HIDEA.bootstrapNotifyDanger = function(message) {
        $.notify({
            message: message
        }, {
            // settings
            type: 'danger',
            allow_dismiss: true,
            placement: {
                from: 'top',
                align: 'right'
            },
            offset: 40,
            spacing: 10,
            z_index: 13000,
            delay: 2500,
            timer: 1000
        })
    };

    HIDEA.spannerOn = function() {
        var _this = this;
        $('#overlay-spanner').addClass('show');
        $('.spanner').addClass('show');
        setTimeout(function() {
            _this.isAllowSpannerOff = true;
        }, 5000);
    }

    HIDEA.spannerOff = function() {
        $('#overlay-spanner').removeClass('show');
        $('.spanner').removeClass('show');
    }

    HIDEA.spannerOffByLazy = function() {
        if (this.isAllowSpannerOff) {
            $('#overlay-spanner').removeClass('show');
            $('.spanner').removeClass('show');
        }
        this.isAllowSpannerOff = false;
    }
};

var CommonUtil = CommonModule('*', function() {});

$(function() {

    /**
     * 숫자와 '-' 허용
     * input:text 태그에 telNoOnly Attribute가 있어야함
     */
    $('input:text[telNoOnly]').keyup(function () {
        $(this).val($(this).val().replace(/[^0-9\-]/g,""));
    }).focusout(function() {
        $(this).val($(this).val().replace(/[^0-9\-]/g,""));
    });

    /**
     * 숫자만 허용
     * input:text 태그에 numberOnly Attribute가 있어야함
     */
    $('input:text[numberOnly]').keyup(function () {
        $(this).val($(this).val().replace(/[^0-9]/g,""));
    }).focusout(function() {
        $(this).val($(this).val().replace(/[^0-9]/g,""));
    });

    $('input[minlength]').keyup(function () {
        var $this = $(this);
        var minLength = $this.attr('minlength');
        var field = document.getElementById($this.attr('id'));
        if ($this.val().length < minLength) {
            var message = $this.attr('title') + '은(는) 최소 ' + minLength + '이상 입력해야 합니다.';;
            CommonUtil.createInvalidInputDiv(field, message);
        } else {
            $this.removeClass('is-invalid');
        }
    });

    /**
     * 부트스트랩 파일업로드 input과 label에 파일명 표시
     */
    $('.custom-file-input').on('change', function() {
        var totalFile = document.getElementById($(this).attr('id')).files;
        var html = '';
        for (var i = 0; i < totalFile.length; i++) {
            var file = totalFile[i];
            html += file.name+", ";
        }
        html = html.substring(0, html.lastIndexOf(','));
        $(this).siblings('.custom-file-label').addClass("selected").html(html);
    });

}).on('click', '.overlay', '.spanner', function() {
    CommonUtil.spannerOffByLazy();
});

/**
 * String의 prototype에 isEmpty 메소드를 추가
 *
 * 문자열이 null 또는 undefined (==null) 이거나
 * 문자열의 길이가 0일 경우 (0은 false이므로 !하면 true 반환)
 *
 * @returns {boolean}
 */
String.prototype.isEmpty = function() {
    return this == null || !this.length || this === '';
};

/**
 * java.lang.String.endsWith() 구현
 */
String.prototype.endsWith = function(str, checker) {
    if (str != null && checker != null && str.length > checker.length) {
        return str.substr(str.length - checker.length).toUpperCase() === checker.toUpperCase();
    } else {
        return false;
    }
};

/**
 * java.lang.String.startWith() 구현
 */
String.prototype.startWith = function(str, checker) {
    if (str != null && checker != null && str.length > checker.length) {
        return str.toUpperCase().substr(0, checker.toUpperCase().length) === checker.toUpperCase();
    } else {
        return false;
    }
};


String.prototype.replaceAll = function(org, dest) {
    return this.split(org).join(dest);
};

/**
 * 배열 목록에서 랜덤하게 순서 정렬
 */
Array.prototype.random = function() {
    return this.sort(function() {
        return Math.random()*3-2;
    });
};

/**
 * jQuery input 필터 생성 함수 선언
 * 복사 붙여넣기, 드래그앤드롭, 키보드 단축키, 단축메뉴 등 상황에서 적용
 *
 * 사용법
 * ```
 * $(document).ready(function() {
 *  $("#myTextBox").inputFilter(function(value) {
 *      return /^\d*$/.test(value);    // Allow digits only, using a RegExp
 *  });
 * });
 * ```
 */
(function($) {
    $.fn.inputFilter = function(inputFilter) {
        return this.on("input keydown keyup mousedown mouseup select contextmenu drop", function() {
            if (inputFilter(this.value)) {
                this.oldValue = this.value;
                this.oldSelectionStart = this.selectionStart;
                this.oldSelectionEnd = this.selectionEnd;
            } else if (this.hasOwnProperty("oldValue")) {
                this.value = this.oldValue;
                this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
            } else {
                this.value = "";
            }
        });
    };
}(jQuery));

function newMap() {
	var map = {};
	map.getKey = function(id) {
		return id;
	};
	map.put = function(id, value) {
		var key = map.getKey(id);
		map[key] = value;
	};
	map.contains = function(id) {
		var key = map.getKey(id);
		if (map[key]) {
			return true;
		} else {
			return false;
		}
	};
	map.get = function(id) {
		var key = map.getKey(id);
		if (map[key]) {
			return map[key];
		}
		return null;
	};
	map.remove = function(id) {
		var key = map.getKey(id);
		if (map.contains(id)) {
			map[key] = undefined;
		}
	};

	return map;
}

function svgControl(){
	$('img.svg').each(function() {
		var $img = $(this);
		var imgID = $img.attr('id');
		var imgClass = $img.attr('class');
		var imgURL = $img.attr('src');
		$.get(imgURL, function(data) {
			// Get the SVG tag, ignore the rest
			var $svg = $(data).find('svg');
			// Add replaced image's ID to the new SVG
			if (typeof imgID !== 'undefined') {
				$svg = $svg.attr('id', imgID);
			}
			// Add replaced image's classes to the new SVG
			if (typeof imgClass !== 'undefined') {
				$svg = $svg.attr('class', imgClass + ' replaced-svg');
			}
			// Remove any invalid XML tags as per http://validator.w3.org
			$svg = $svg.removeAttr('xmlns:a');
			// Replace image with new SVG
			$img.replaceWith($svg);
		}, 'xml');
	});
}

Math.easeOutBounce = function (pos) {
    if ((pos) < (1 / 2.75)) {
        return (7.5625 * pos * pos);
    }
    if (pos < (2 / 2.75)) {
        return (7.5625 * (pos -= (1.5 / 2.75)) * pos + 0.75);
    }
    if (pos < (2.5 / 2.75)) {
        return (7.5625 * (pos -= (2.25 / 2.75)) * pos + 0.9375);
    }
    return (7.5625 * (pos -= (2.625 / 2.75)) * pos + 0.984375);
};


function setCookie(cName, cValue, cDay){
    var expire = new Date();
    expire.setDate(expire.getDate() + cDay);
    var cookies = cName + '=' + escape(cValue) + '; path=/ ';
    if(typeof cDay != 'undefined') cookies += ';expires=' + expire.toGMTString() + ';';
    document.cookie = cookies;
}

	
function deleteCookie(cookieName){
    var expireDate = new Date();
    expireDate.setDate(expireDate.getDate() - 1);
    document.cookie = cookieName + "= " + "; expires=" + expireDate.toGMTString();
}
 
function getCookie(cookieName) {
    cookieName = cookieName + '=';
    var cookieData = document.cookie;
    var start = cookieData.indexOf(cookieName);
    var cookieValue = '';
    if(start != -1){
        start += cookieName.length;
        var end = cookieData.indexOf(';', start);
        if(end == -1)end = cookieData.length;
        cookieValue = cookieData.substring(start, end);
    }
    return unescape(cookieValue);
}

function setAnimateCount(){
	$('.count').each(function () {
        $(this).prop('Counter',0).animate({
            Counter: $(this).text()
        }, {
            duration: 3000,
            easing: 'swing',
            step: function (now) {
                $(this).text(Math.ceil(now));
            }
        });
    });
}

/*
 * XMLHttpRequest 가 사용 가능한지 확인
 */
function initRequest(url) {
    if (window.XMLHttpRequest) {
        return new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        return new ActiveXObject("Microsoft.XMLHTTP");
    }
}

/*
 * XMLHttpRequest 가 사용 가능한지 확인
 */
function isXMLHttpRequest() {
    if (window.XMLHttpRequest && navigator.appName.indexOf("Internet Explorer") < 0) {
        return true;
    } else if (window.ActiveXObject) {
        return false;
    }
    return false;
}

/*
 * XMLHttpRequest를 인스턴스 객체에서 참조할 경우 사용
 */
function getDefaultXMLHttpRequest (strUrl){
    var req = initRequest(strUrl);
    if(req==null){
        alert(messageAlerTxt6);
        return null;
    }else{
        req.onreadystatechange = function(){
            // 본래 이곳에서 XML 파싱등의 처리를 해야 하나 마지막 라인 return req 를 통해 사용하는 인스턴스 객체에서 사용토록 처리한다.
        };
        if(isXMLHttpRequest()){
            req.overrideMimeType('text/xml');
        }
        req.open("GET", strUrl, true);
        req.send(null);
        return req;
    }
}

function numberOnly(obj) {
    $(obj).val($(obj).val().replace(/[^0-9]/g,""));
}

function goAction(url, target) {
    if (!target) {
        target = '_blank';
    }

    window.open(url, target);

}

/**
* 자바스크립트 Date 객체를 Time 스트링으로 변환
* parameter date: JavaScript Date Object
*/
function toTimeString(date) { //formatTime(date)
   var year  = date.getFullYear();
   var month = date.getMonth() + 1; // 1월=0,12월=11이므로 1 더함
   var day   = date.getDate();
   var hour  = date.getHours();
   var min   = date.getMinutes();

   if (("" + month).length == 1) { month = "0" + month; }
   if (("" + day).length   == 1) { day   = "0" + day;   }
   if (("" + hour).length  == 1) { hour  = "0" + hour;  }
   if (("" + min).length   == 1) { min   = "0" + min;   }

   return ("" + year + month + day + hour + min)
}

function toTimeStringSec(date) {
   var year  = date.getFullYear();
   var month = date.getMonth() + 1; // 1월=0,12월=11이므로 1 더함
   var day   = date.getDate();
   var hour  = date.getHours();
   var min   = date.getMinutes();
   var sec   = date.getSeconds();

   if (("" + month).length == 1) { month = "0" + month; }
   if (("" + day).length   == 1) { day   = "0" + day;   }
   if (("" + hour).length  == 1) { hour  = "0" + hour;  }
   if (("" + min).length   == 1) { min   = "0" + min;   }
   if (("" + sec).length   == 1) { sec   = "0" + sec;   }

   return ("" + year + month + day + hour + min + sec)
}

/**
 * 대상자의 타임존을 적용하여 현재 Date Object를 반환한다.
 * * TMZ는 header.jsp에 USER_INFO.timezone으로 설정되어있다.
 * @returns {Date}
 */
function getDateObjWithTmz() {
    var tzOffset = 9; // KOR 기준
    if (TMZ != null) {
        tzOffset = TMZ;
    }
    var now = new Date();
    var tz = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 3600000);
    now.setTime(tz);
    return now;
}

function getCurrentTimeSecWithTmz() {
    return toTimeStringSec(getDateObjWithTmz());
}

/**
 * 대상자의 타임존을 적용하여 현재 시간을 계산하여 리턴한다.
 * TMZ는 header.jsp에 USER_INFO.timezone으로 설정되어있다.
 *
 */
function getCurrentTimeWithTmz() {
    var tzOffset = 9; // KOR 기준
    if (TMZ != null) {
        tzOffset = TMZ;
    }
    var now = new Date();
    var tz = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 3600000);
    now.setTime(tz);
    return toTimeString(now);
}

function getFullDateWithTmz() {
    return getCurrentTimeWithTmz().substr(0,8);
}

function getLocationColor(location) {
    var color = "#FFFFFF";

    if (location === 'roomA') {
        color = "rgba(22, 170, 79, 1)";
    } else if (location === 'roomB') {
        color = "rgba(183, 203, 0, 1)";
    } else if (location === 'livingA') {
        color = "rgba(90, 65, 151, 1)";
    } else if (location === 'livingB') {
        color = "rgba(148, 110, 246, 1)";
    } else if (location === 'kitchen') {
        color = "rgba(241, 92, 34, 1)";
    } else if (location === 'bath') {
        color = "#1ea3dc";
    } else if (location === 'bathB') {
        color = '#0079c1';
    } else if (location === 'out') {
        color = '#808080';
    }

    return color;
}


function getLocationName(location) {
    var locationName = '';

    if (location === 'roomA') {
        locationName = locationRoomA;
    } else if (location === 'roomB') {
        locationName = locationRoomB;
    } else if (location === 'livingA') {
        locationName = locationLivingA;
    } else if (location === 'livingB') {
        locationName = locationLivingB;
    } else if (location === 'kitchen') {
        locationName = locationKitchen;
    } else if (location === 'bath') {
        locationName = locationBath;
    } else if (location === 'bathB') {
        locationName = locationBathB;
    } else if (location === 'out') {
        locationName = locationOut;
    }


    return locationName;
}

function date_add(c, b) {
    var f = Number(c.substring(0, 4));
    var e = Number(c.substring(4, 6));
    var a = Number(c.substring(6, 8));
    d = new Date(f,e - 1,a + b);
    f = d.getFullYear();
    e = d.getMonth() + 1;
    e = (e < 10) ? "0" + e : e;
    a = d.getDate();
    a = (a < 10) ? "0" + a : a;
    return "" + f + "" + e + "" + a
}