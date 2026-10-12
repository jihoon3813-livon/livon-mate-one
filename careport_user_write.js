
const UserWriteHandler = {
 	init: function(){

 	},
 	//대상자 리스트
 	userList: function(){
 		location.href = "/main/user/userList";
 	},
 	//대상자 등록
 	userSave: function(){
 		var organization = $('#organization').val();
 		var birth  = $("#fmUsr #birth").val();
 		var serviceType = $("#fmUsr input[name='service_type']:checked").val();
 		var userType = $("#fmUsr input[name='user_type']:checked").val();
		var gender = $("#fmUsr input[name='gender']:checked").val();

		if(!organization) {
			alert('서브 그룹까지 선택해주세요');
			return false;
		}

		birth  = birth.replace(/-/gi,"");
		serviceType = ( serviceType == "41" ? "1" : "2" );
		userType = ( userType == "41" ? "1" : "2" );
		gender = ( gender == "M" ? "1" : "2" );

		var rrno   = birth+gender;								// 201012311

		$("#fmUsr #birth").val(birth);
		$("#fmUsr #rrno").val(rrno);


		if (!$('#user_name').val()){
			alert('대상자 명 입력하여 주십시오.');
			$('#user_name').focus();
			return;
		}
		if (!$('#birth').val()){
			alert('생년월일 입력하여 주십시오.');
			$('#birth').focus();
			return;
		}
		if (!$('#htel').val() && !$('#mtel').val()){
			alert('연락처 (집전화, 핸드폰) 입력하여 주십시오.');
			$('#mtel').focus();
			return;
		}
		if (!$('#zip').val()){
			alert('현주소(실제 거주지) 입력하여 주십시오.');
			$('#zip').focus();
			return;
		}
		if (!$('#address_basic').val()){
			alert('현주소(실제 거주지) 입력하여 주십시오.');
			$('#address_basic').focus();
			return;
		}
		if (!$('#address_detail').val()){
			alert('현주소(실제 거주지) 입력하여 주십시오.');
			$('#address_detail').focus();
			return;
		}
		/*
		if (!$('#family_tel1_name').val()){
			alert('비상연락자 성명 입력하여 주십시오.');
			$('#g_nm0').focus();
			return;
		}
		*/
		if ($('#family_tel1_name').val() != ""){
			if(!$("select[name=family_tel1_type]").val()){
				alert("비상연락자 1의 관계 선택해 주세요.");
				$("select[name=family_tel1_type]").focus();
				return false;
			}
			if (!$('#family_tel1_number').val()){
				alert('비상연락자 1의 연락처 입력하여 주십시오.');
				$('#family_tel1_number').focus();
				return;
			}
		}
		if ($('#family_tel2_name').val() != ""){
			if(!$("select[name=family_tel2_type]").val()){
				alert("비상연락자 2의 관계 선택해 주세요.");
				$("select[name=family_tel2_type]").focus();
				return false;
			}
			if (!$('#family_tel2_number').val()){
				alert('비상연락자 2의 연락처 입력하여 주십시오.');
				$('#family_tel2_number').focus();
				return;
			}
		}
		if ($('#family_tel3_name').val() != ""){
			if(!$("select[name=family_tel3_type]").val()){
				alert("비상연락자 3의 관계 선택해 주세요.");
				$("select[name=family_tel3_type]").focus();
				return false;
			}
			if (!$('#family_tel3_number').val()){
				alert('비상연락자 3의 연락처 입력하여 주십시오.');
				$('#family_tel3_number').focus();
				return;
			}
		}
		if ($('#family_tel4_name').val() != ""){
			if(!$("select[name=family_tel4_type]").val()){
				alert("비상연락자 4의 관계 선택해 주세요.");
				$("select[name=family_tel4_type]").focus();
				return false;
			}
			if (!$('#family_tel4_number').val()){
				alert('비상연락자 4의 연락처 입력하여 주십시오.');
				$('#family_tel4_number').focus();
				return;
			}
		}

		if( confirm("대상자 신청을 하시겠습니까?") ) {

			var param  = $("#fmUsr").serializeObject();

			var birth  = $("#fmUsr #birth").val();
	 		var serviceType = $("#fmUsr input[name='service_type']:checked").val();
 			var userType = $("#fmUsr input[name='user_type']:checked").val();
			var gender = $("#fmUsr input[name='gender']:checked").val();

			birth      = birth.replace(/-/gi,"");
			serviceType = ( serviceType == "NEW" ? "1" : "2" );
			userType 	= ( userType == "41" ? "1" : "2" );
			gender     = ( gender == "M" ? "1" : "2" );

			param.rrno = birth+gender;
			param.organization = organization;	// 서브그룹 추가 (aid:6)

			console.log( "=============================" );
			console.log( param.rrno );
			console.log( "=============================" );

			$.ajax({
		        url: "/main/user/userWrite/registTargetUser",
		        type : "post",
		        dataType : "json",
		        data: param,
		        cache : false,
		        async: true

		    }).done(function(result, textStatus, jqXHR) {
		    	console.log( result );

		    	if(result.data.RESULT == "FAIL") {
			    	alert( result.data.RESULT_MSG );
		    	}
		    	else {
		    		if(result.data.RESULT_MSG != "") {
		    			alert( result.data.RESULT_MSG );
		    		}
		    		else {
		    			alert("등록되었습니다.");

		    			UserWriteHandler.userList();
		    		}
		    	}

		    }).fail(function(jqXHR, textStatus, errorThrown) {
		    	console.log( jqXHR );

		    });
		}
 	},
 	// 주소검색(API사용)
	findAddress: function() {
		/*
		 * 세션 끊기는 문제로 검색 방법 변경
		 */
		var url = "/main/common/searchAddress";
        var pop = window.open(url,"pop","width=570,height=420, scrollbars=yes, resizable=yes");
	}
}

function jusoCallBack(rtRoadFullAddr, rtAddrPart1, rtAddrDetail, rtAddrPart2, rtEngAddr, rtJibunAddr, rtZipNo, rtAdmCd, rtRnMgtSn, rtBdMgtSn, rtDetBdNmList, rtBdNm, rtBdKdcd, rtSiNm, rtSggNm, rtEmdNm, rtLiNm, rtRn, rtUdrtYn, rtBuldMnnm, rtBuldSlno, rtMtYn, rtLnbrMnnm, rtLnbrSlno, rtEmdNo) {
	// document.fmUsr.zip.value 			= rtZipNo;
	// document.fmUsr.address_basic.value 	= rtRoadFullAddr;
	// document.fmUsr.address_detail.value = rtAddrDetail;

	// $("#address_jibun_basic").val(rtJibunAddr);
	// $("#address_bdong").val(rtEmdNm);
	// $("#address_hdong").val(rtEmdNm);
	// $("#address_ri").val(rtLiNm);

    if(arguments.length < 1){
        return;
    }

    var data = {
        fullAddr : arguments[0] || "", // 전체주소 (사용자 입력 포함)
        address : arguments[1] || "", // 전체주소 (사용자 입력 미포함)

        addressDetail : arguments[2] || "", // 사용자 직접입력 상세주소

        zonecode : arguments[6] || "", // 우편번호
        roadAddress : arguments[1] || "", // 도로명주소
        jibunAddress : arguments[5] || "", // 지번주소

        bcode : arguments[7] || "", // 법정동코드
        buildingName : arguments[11] || "", // 건물명

        // 도로명주소(상세)
        road : arguments[1] || "",
        roadName : arguments[17] || "", // 도로명
        bonbun : arguments[19] || "", // 본번
        bubun : arguments[20] || "", // 부번

        // 지번주소(상세)
        sido : arguments[13] || "", // 서비스
        sigungu : arguments[14] || "", // 그룹
        dong : arguments[15] || "", // 읍면동
        ri : arguments[16] || "", // 리
        bunji : arguments[22] || "", // 번지
        ho : arguments[23] || "" // 호
    };
    data['jibun'] = data.sido + " " + data.sigungu + " " + data.dong + (data.ri ? " " : "") + data.ri + " " + data.bunji + (data.ho ? "-" : "") + data.ho;
    console.log(JSON.stringify(data, null, ' '));
    var addressDetail = data.buildingName + (data.addressDetail ? ' ' : '') + $.trim(data.addressDetail.replace(data.buildingName, ''));

    document.fmUsr.zip.value 			= data.zonecode;
	document.fmUsr.address_basic.value 	= data.road;
	document.fmUsr.address_detail.value = addressDetail;

	$("#address_jibun_basic").val(data.jibun);
	$("#address_jibun_detail").val(addressDetail);
	$("#address_bdong").val(data.dong);
	$("#address_hdong").val(data.dong);
	$("#address_ri").val(data.ri);

	$("#cv_code").val(data.bcode.substr(0, 5));
}

$(document).ready(function(){
	//한글만 입력 처리
	/*
	$("#user_name, #family_tel1_name, #family_tel2_name, #family_tel3_name, #family_tel4_name").keyup(function(event){
		if (!(event.keyCode >=37 && event.keyCode<=40)) {
			var inputVal = $(this).val();
			$(this).val(inputVal.replace(/[a-z0-9]|[ ``\[\]{}()<>?|~!@#$%^&*-_+=,.;:\"\\]/g, ''));
		}
	});
	*/

	//숫자만 입력 처리
	$("#htel, #mtel, #family_tel1_number, #family_tel2_number, #family_tel3_number, #family_tel4_number").keyup(function(event){
		if (!(event.keyCode >=37 && event.keyCode<=40)) {
			var inputVal = $(this).val();
			$(this).val(inputVal.replace(/[^0-9]/gi,''));
		}
	});

	$.datepicker.setDefaults({
        /*
        dateFormat: 'yy-mm-dd',	//날짜 포맷이다. 보통 yy-mm-dd 를 많이 사용하는것 같다.
        prevText: '이전 달',	// 마우스 오버시 이전달 텍스트
        nextText: '다음 달',	// 마우스 오버시 다음달 텍스트
        closeText: '닫기', // 닫기 버튼 텍스트 변경
        //currentText: '오늘', // 오늘 텍스트 변경
        monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],	//한글 캘린더중 월 표시를 위한 부분
        monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],	//한글 캘린더 중 월 표시를 위한 부분
        dayNames: ['일', '월', '화', '수', '목', '금', '토'],	//한글 캘린더 요일 표시 부분
        dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],	//한글 요일 표시 부분
        dayNamesMin: ['일', '월', '화', '수', '목', '금', '토'],	// 한글 요일 표시 부분
        showMonthAfterYear: true,	// true : 년 월  false : 월 년 순으로 보여줌
        yearSuffix: ' ',	//
        showButtonPanel: true,	// 오늘로 가는 버튼과 달력 닫기 버튼 보기 옵션
        buttonImageOnly: true,	// input 옆에 조그만한 아이콘으로 캘린더 선택가능하게 하기
		changeMonth: true,
		changeYear: true,
		defaultDate:"1940-05-1",
		*/

		dateFormat: 'yy-mm-dd' //Input Display Format 변경
		, showOtherMonths: true //빈 공간에 현재월의 앞뒤월의 날짜를 표시
		, showMonthAfterYear:true //년도 먼저 나오고, 뒤에 월 표시
		, changeYear: true //콤보박스에서 년 선택 가능
		, changeMonth: true //콤보박스에서 월 선택 가능
		, buttonText: "선택" //버튼에 마우스 갖다 댔을 때 표시되는 텍스트
		, yearSuffix: "년" //달력의 년도 부분 뒤에 붙는 텍스트
		, monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']	//한글 캘린더 중 월 표시를 위한 부분
		, monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'] //달력의 월 부분 Tooltip 텍스트
		, dayNamesMin: ['<span style="color:red;">일</span>','월','화','수','목','금','<span style="color:blue;">토</span>'] //달력의 요일 부분 텍스트
		, dayNames: ['<span style="color:red;">일</span>','월','화','수','목','금','<span style="color:blue;">토</span>'] //달력의 요일 부분 Tooltip 텍스트
		, minDate: "-110Y" //최소 선택일자(-1D:하루전, -1M:한달전, -1Y:일년전)
		, maxDate: "+1D" //최대 선택일자(+1D:하루후, -1M:한달후, -1Y:일년후)
		, currentText: "오늘"
		, closeText: "닫기"
		, yearRange: "-120:+0"
		// ,defaultDate: '1940-01-01'
    });

    $( "#birth" ).datepicker();

    $("#user_name").focus();
});

