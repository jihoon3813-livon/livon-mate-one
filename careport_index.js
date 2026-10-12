/**
 * 
 */
const IndexHandler = {
	init: function() {
	},
	logout: function() {
		if (confirm("로그아웃을 하시겠습니까?") == true){
			location.href = "/main/logout";
		}else{
		     return false;
		}
	},
	passWordChangelogout: function() {
			location.href = "/main/logout";
	},
	xCareOpen: function(url, email,popName) {
		if(url != "" && email != "") {
			//var popName = "xCarePop";
			
			$("#xCarePop #email").val(email);
			$("#xCarePop #token").val("hideay48y4bqpk");
			$("#xCarePop #location").val("ko");
			
			$("#xCarePop").attr("action", url);
			$("#xCarePop").attr("target", popName);
			$("#xCarePop").attr("method", "post");
				
			var popup = this.openPopupWin("", popName, 1800, 1000);
			
			$("#xCarePop").submit(); 
		}
	},
	
	//팝업창 업무 
	openPopupWin: function(actionUrl, name, width, height) {
		var left =  window.outerWidth / 2 + window.screenX - ( width / 2);		// (screen.width / 2) - (width / 2);
		var top  =  window.outerHeight / 2 + window.screenY - ( height / 2);		// 20; //(screen.height / 2) - (height / 2);
		
		var strAttribute = "width=" + width + ", height=" + height + ", top=" + top + ", left=" + left;
		
		strAttribute +=  ", menubar=no, scrollbars=yes, location= no, status=no, resizable=yes, toolbar=no";

		
		return window.open(actionUrl, name, strAttribute);
	},
};

$(document).ready(function(){
	IndexHandler.init();
});
 
  //메인 공지사항 팝업 & 쿠키 관련
$( function() {	
 	
	dialog = $( "#dialog-confirm0" ).dialog({
		autoOpen: false,
		resizable: false,
		position: { my: "center", at: "center", of: window },

		width: 500, //500
		height: 550, //550
		modal: false,
		buttons: {			
			"오늘 하루 보지 않기 ": function() {
				setCookieMobile( "todayCookie2", "done" , 1);

				$( this ).dialog( "close" );
			}
		}
	});

	function setCookieMobile ( name, value, expiredays ) {
		var todayDate = new Date();
		todayDate.setDate( todayDate.getDate() + expiredays );
		document.cookie = name + "=" + escape( value ) + "; path=/; expires=" + todayDate.toGMTString() + ";"
	}
	function getCookieMobile () {
		var cookiedata = document.cookie;
		if ( cookiedata.indexOf("todayCookie2=done") < 0 ){
			dialog.dialog( "open" );
			//console.log('1');
		}
		else {
			dialog.dialog( "close" );
			//console.log('2');
		}
	}

	getCookieMobile();
	
	$("#dialog-confirm0").closest(".ui-dialog").attr("id","pop-notice");
});
 