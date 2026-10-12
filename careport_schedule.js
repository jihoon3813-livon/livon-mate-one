const ScheduleHandler = {
    scheduleObj: [],
    adminLocations: [],
    adminLocationMarkers: [],
    adminSchedules: [],
    adminScheduleMarkers: [],
    map: null,
    loadLocation: function() {
        $('#locationInfoTable').dataTable({
            autoWidth: false,
            processing: true,
            ordering: true,
            serverSide: true,
            searching: false,
            info: true,
            paging: true,
            pageLength: 10,
            lengthMenu: [10, 25, 50],
            lengthChange: true,
            order: [],
            language: dataTableLanguageKorea,
            destroy: true,
            scrollX: true,
            ajax: {
                url: '/main/schedule/visitor/location',
                type: 'post',
                contentType: 'application/json',
                data: function(d) {
                    d.searchDt = $('#searchDt').val();
                    d.level6Gid = $("#organization option:selected").val();
                    return JSON.stringify(d);
                }
            },
            createdRow: function (row, data, dataIndex) {
                $(row).attr('data-id', data.id);
            },
            columns: [
                {data: '', name: ''}
                , {data: 'adminId', name: 'adminId'}
                , {data: 'adminName', name: 'adminName'}
                , {data: 'tel', name: 'tel'}
                , {data: 'location', name: 'location'}
                , {data: 'latitude', name: 'latitude'}
                , {data: 'longitude', name: 'longitude'}
                , {data: 'updatedAt', name: 'updatedAt'}
            ],
            columnDefs: [
                {
                    "targets": 0,
                    'searchable': false,
                    "orderable": false,
                    'render': function (data, type, row) {
                        return '<input type="checkbox" class="contractor-checkbox" name="visitor-checkbox">';
                    }
                }
            ],
            initComplete: function (settings, json) {
                ScheduleHandler.adminLocations.length = 0; // 초기화 해주기
                const center = ScheduleHandler.calculateCenter(json.data);
                ScheduleHandler.map = new naver.maps.Map('map', {
                    center: center,
                    zoom: 11
                });
                // 초기화 하면서
                json.data.forEach(function(item) {
                    let marker = new naver.maps.Marker({
                        position: new naver.maps.LatLng(item.latitude, item.longitude),
                        map: ScheduleHandler.map,
                        icon: {
                            content: [
                                '<div class="marker">' + item.adminName + '</div>'
                            ].join('')
                        }
                    });
                    ScheduleHandler.adminLocations.push(item);
                });

                // 각 row에 click 이벤트 바인딩
                $('#locationInfoTable tbody').on('click', 'tr', function() {
                    let data = $('#locationInfoTable').DataTable().row(this).data();
                    location.href = '/main/schedule/view/visitor/schedule/' + data.adminId;
                });
            }
        })
    },
    calculateCenter: function(coordinates) {
        if (coordinates.length === 0) {
            return { lat: 37.5240867, lng: 126.9803881 }; // 빈 배열이면 기본값 용산 반환
        }

        let sumLat = 0;
        let sumLng = 0;

        // 모든 좌표의 위도와 경도를 더합니다.
        coordinates.forEach(coord => {
            sumLat += coord.latitude;
            sumLng += coord.longitude;
        });

        // 평균을 계산하여 중심 좌표를 구합니다.
        let centerLat = sumLat / coordinates.length;
        let centerLng = sumLng / coordinates.length;

        return { lat: centerLat, lng: centerLng };
    },
    fetchAdminLocationByAdminId: function () {
        const requestUrl = '/main/schedule/visitor/location/' + $('#adminId').val();
        $.ajax({
            type: 'post',
            url: requestUrl,
            contentType: 'application/json',
            success : function(data) {
                if(data) {
                    $('#visitorName').text(data.adminName);
                    $('#lastLocation').text(data.location + " (" + data.updatedAt + ")");

                    let visitorMarker = new naver.maps.Marker({
                        position: new naver.maps.LatLng(data.latitude, data.longitude),
                        map: ScheduleHandler.map,
                        icon: {
                            content: [
                                '<div class="green-marker">' + data.adminName + '</div>'
                            ].join('')
                        }
                    });
                }
            },
            error : function(err) {
                console.log(err);
            }
        });
    }, // 상단 방문자명 및 최근 위치 등
    initSchedule: function() {
        this.loadSchedule();
    },
    loadSchedule: function() {
        $('#scheduleInfoTable').dataTable({
            autoWidth: false,
            processing: true,
            ordering: true,
            serverSide: true,
            searching: false,
            info: true,
            paging: true,
            /* dom: 'r<"table-responsive xy box_bd mh h530"t><"table-pagination"lip>', */
            pageLength: 10,
            lengthMenu: [10, 25, 50],
            lengthChange: true,
            order: [],
            language: dataTableLanguageKorea,
            destroy: true, // 테이블 다시 render
            scrollX: true,
            ajax: {
                url: '/main/schedule/visitor/schedule',
                type: 'post',
                contentType: 'application/json',
                data: function(d) {
                    d.searchDt = $('#searchDt').val();
                    d.adminId = $('#adminId').val();
                    return JSON.stringify(d);
                }
            },
            createdRow: function (row, data, dataIndex) {
                $(row).attr('data-id', data.id);
            },
            columns: [
                {data: '', name: ''}
                , {data: 'userId', name: 'userId'}
                , {data: 'userName', name: 'userName'}
                , {data: 'userTel', name: 'userTel'}
                , {data: 'status', name: 'status'}
                , {data: 'location', name: 'location'}
                , {data: 'visitStartDatetime', name: 'visitStartDatetime'}
                , {data: 'visitEndDatetime', name: 'visitEndDatetime'}
            ],
            columnDefs: [
                {
                    "targets": 0,
                    'searchable': false,
                    "orderable": false,
                    'render': function (data, type, row) {
                        return '<input type="checkbox" class="contractor-checkbox" name="visitor-checkbox">';
                    }
                }
            ],
            initComplete: function (settings, json) {
                ScheduleHandler.adminSchedules.length = 0; // 초기화 해주기
                const center = ScheduleHandler.calculateCenter(json.data);
                ScheduleHandler.map = new naver.maps.Map('map', {
                    center: center,
                    zoom: 11
                });
                // 초기화 하면서
                json.data.forEach(function(item) {
                    ScheduleHandler.adminSchedules.push(item);
                });

                // map의 boundary init 시켜주기
                const swne = ScheduleHandler.findSouthWestAndNorthEastCoordinates(ScheduleHandler.adminSchedules);
                if(swne) {
                    let boundary = naver.maps.LatLngBounds.bounds(
                        new naver.maps.LatLng(swne.northEast.latitude, swne.northEast.longitude),
                        new naver.maps.LatLng(swne.southWest.latitude, swne.southWest.longitude)
                    )
                    ScheduleHandler.map.fitBounds(boundary);
                }

                json.data.forEach(function(item) {
                    ScheduleHandler.adminScheduleMarkers.length = 0;
                    let marker = new naver.maps.Marker({
                        position: new naver.maps.LatLng(item.latitude, item.longitude),
                        map: ScheduleHandler.map,
                        icon: {
                            content: [
                                '<div class="marker">' + item.userName + '</div>'
                            ].join('')
                        }
                    });
                    ScheduleHandler.adminScheduleMarkers.push(marker);
                })

                ScheduleHandler.fetchAdminLocationByAdminId();
            }
        });

    },
    loadAdminInfo: function() {
        // 대상자 정보 가져와서 상단에 뿌려주기
        $('#visitorInfoTable').dataTable({
            autoWidth: false,
            processing: true,
            ordering: true,
            serverSide: true,
            searching: false,
            info: true,
            paging: true,
            pageLength: 10,
            lengthMenu: [10, 25, 50],
            lengthChange: true,
            order: [],
            language: dataTableLanguageKorea,
            destroy: true,
            scrollX: true,
            ajax: {
                url: '/main/schedule/visitor',
                type: 'post',
                contentType: 'application/json',
                data: function(d) {
                    d.level6Gid = $("#organization option:selected").val();
                    return JSON.stringify(d);
                }
            },
            createdRow: function (row, data, dataIndex) {
                $(row).attr('data-id', data.id);
            },
            columns: [
                {data: '', name: ''}
                , {data: 'id', name: 'id'}
                , {data: 'name', name: 'name'}
                , {data: 'tel', name: 'tel'}
                , {data: 'addressBasic', name: 'addressBasic'}
                , {data: 'addressDetail', name: 'addressDetail'}
            ],
            columnDefs: [
                {
                    "targets": 0,
                    'searchable': false,
                    "orderable": false,
                    'render': function (data, type, row) {
                        return '<input type="checkbox" class="contractor-checkbox" name="visitor-checkbox">';
                    }
                },
                {
                    'targets': 6,
                    'searchable': false,
                    'orderable': false,
                    'render': function (data, type, row) {
                        let id = row.id;
                        return '<button type="button" class="btn btn-success btn-sm reverse-check" onclick="location.href=\'/main/schedule/view/visitor/scheduleRegistration/' + id + '\'">등록</button>';
                    }
                }
            ],
            initComplete: function (settings, json) {
                // 각 row에 click 이벤트 바인딩
                $('#locationInfoTable tbody').on('click', 'tr', function() {
                    // let data = $('#locationInfoTable').DataTable().row(this).data();
                    // location.href = '/main/schedule/view/visitor/schedule/' + data.adminId;
                });
            }
        })
    },
    findSouthWestAndNorthEastCoordinates: function(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return null;
        }

        let southWest = { latitude: Infinity, longitude: Infinity };
        let northEast = { latitude: -Infinity, longitude: -Infinity };

        coordinates.forEach(coord => {
            if (coord.latitude < southWest.latitude) southWest.latitude = coord.latitude;
            if (coord.longitude < southWest.longitude) southWest.longitude = coord.longitude;
            if (coord.latitude > northEast.latitude) northEast.latitude = coord.latitude;
            if (coord.longitude > northEast.longitude) northEast.longitude = coord.longitude;
        });

        return { southWest, northEast };
    },
    findAddress: function () {
        var url = "/main/common/searchAddress";
        var pop = window.open(url,"pop","width=570,height=420, scrollbars=yes, resizable=yes");
    },
    getLngLat: function (addressBasic) {
        let data = {
            addressBasic: addressBasic
        };
        $.ajax({
            url : "/main/schedule/user/address",
            type : "POST",
            contentType : "application/json",
            data : JSON.stringify(data),
            beforeSend: function() {
            },
            success : function(data) {

                if(data.addresses.length >= 1) {
                    let lat = data.addresses[0].y;
                    let lng = data.addresses[0].x;

                    $('#longitude').val(lng);
                    $('#latitude').val(lat);
                }
            }
        }).always(function() {
        });
    },
    loadAdminsUsers: function() {
        let _this = this;
        // 해당 datatable 채우기 -> 해당 테이블 데이터 조회해오기부터 시작
        this.$recipientListTable = $('#recipientListTable').DataTable({
            autoWidth: false,
            processing: true,
            ordering: false,
            serverSide: true,
            searching: false,
            info: true,
            paging: true,
            pageLength: 10,
            lengthMenu: [10, 25, 50],
            lengthChange: true,
            order: [],
            language: dataTableLanguageKorea,
            destroy: true, // 테이블 다시 render
            scrollX: true,
            ajax: {
                url: '/main/schedule/user',
                type: 'post',
                contentType: 'application/json',
                data: function(d) {
                    const url = new URL(window.location.href);
                    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
                    const adminId = pathSegments[5]; // '456'
                    let searchRecipientName = $('#searchRecipientName').val();
                    let searchRecipientTel = $('#searchRecipientTel').val();
                    d.adminId = adminId;
                    d.name = searchRecipientName;
                    d.tel = searchRecipientTel;
                    return JSON.stringify(d);
                }
            },
            createdRow: function (row, data, dataIndex) {
                $(row).attr('data-id', data.id);
            },
            columns: [
                {data: '', name: ''}
                , {data: 'id', name: 'id'}
                , {data: 'name', name: 'name'}
                , {data: 'birth', name: 'birth'}
                , {data: 'gender', name: 'gender'}
                , {data: 'addressBasic', name: 'addressBasic'}
                , {data: 'addressDetail', name: 'addressDetail'}
                , {data: 'tel', name: 'tel'}
                , {data: 'latitude', name: 'latitude', visible: false}
                , {data: 'longitude', name: 'longitude', visible: false}
            ],
            columnDefs: [
                {
                    'targets': 0,
                    'searchable': false,
                    'render': function (data, type, row) {
                        return '<input type="checkbox" class="contractor-checkbox" name="visitor-checkbox">';
                    }
                }
            ],
            initComplete: function (settings, json) {
                $('#recipientListTable tbody').on('click', "input[type='checkbox']", function (e) {
                    ScheduleHandler.scheduleObj.length = 0; // 해당 배열의 길이를 0으로하여 해당 배열을 지운다.
                    var checkboxes = $("#recipientListTable tbody input[type='checkbox']:checked");
                    checkboxes.each(function () {
                        var $row = $(this).closest('tr');
                        var data = _this.$recipientListTable.row($row).data();
                        ScheduleHandler.scheduleObj.push(data);
                    })
                })
            }
        });
    },
    registerSchedule: function () {
        let _this = this;
        // 스케줄에 등록할 값
        if(_this.scheduleObj.length < 1) {
            alert('스케줄을 생성할 대상자를 선택해주세요')
            return false;
        }

        // adminId는 path상 데이터
        const url = new URL(window.location.href);
        const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
        const adminId = pathSegments[5]; // '456'

        const schedule = _this.scheduleObj[0];

        // userId는 this.scheduleObj[i].id;
        const userId = schedule.id;
        // visit_start_datatime은 조립해주기
        // 어디에서 끌어오는지
        let searchDt = $('#searchDt').val();
        let time = $('#hourSelector option:selected').val() + ':' + $('#minuteSelector option:selected').val() + ':' + $('#secondSelector option:selected').val();
        let endTime = $('#endHourSelector option:selected').val() + ':' + $('#endMinuteSelector option:selected').val() + ':' + $('#endSecondSelector option:selected').val();
        const visitStartDatetime = searchDt + " " + time;
        const visitEndDatetime = searchDt + " " + endTime;
        const location = schedule.addressBasic + " " + schedule.addressDetail;
        const latitude = schedule.latitude;
        const longitude = schedule.longitude;

        const adminScheduleDto = {
            "adminId": adminId,
            "userId": userId,
            "visitStartDatetime": visitStartDatetime,
            "visitEndDatetime": visitEndDatetime,
            "location": location,
            "latitude": latitude,
            "longitude": longitude
        }

        console.table(adminScheduleDto);

        $.ajax({
            url: "/main/schedule/visitor/schedule/registration",
            type : "post",
            contentType : "application/json",
            data: JSON.stringify(adminScheduleDto),
            cache : false,
            async: true,
            success: function (data) {
                // 성공 이후에는 어떤 동작?
                console.table(data);
                alert("스케줄 등록에 성공했습니다.");
            },
            error: function (xhr, status, error) {
                console.table(error);
            }
        })
    },
    backToVisitorList: function() {
        location.href = '/main/schedule/view/visitor';
    }
}

$(document).ready(function() {
});