var $window = $(window), gardenCtx, gardenCanvas, $garden, garden;
var offsetX = 0, offsetY = 0;
var heartScale = 1; // 心形整体缩放，供 getHeartPoint 使用

$(function () {
    initGarden();

    // 窗口大小变化时重新初始化（不刷新页面）
    var resizeTimer;
    $(window).resize(function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            // 只在尺寸变化较大时重新初始化
            if (Math.abs($window.width() - gardenCanvas.width) > 50 ||
                Math.abs($window.height() - gardenCanvas.height) > 50) {
                initGarden();
            }
        }, 300);
    });
});

function initGarden() {
    $loveHeart = $("#loveHeart");
    var heartWidth = $loveHeart.width();
    var heartHeight = $loveHeart.height();

    // 心形曲线本征尺寸（未缩放前，scale = min(w,h)/600 时的实际像素范围）
    // x: [-312, 312]，y: [-238.5, 340]，几何中心 (0, 50.7675)
    var baseWidth = 624;
    var baseHeight = 578.5;

    // 1. 先按比例缩放，使心形轮廓尽量铺满画布
    var scale = Math.min(heartWidth / baseWidth, heartHeight / baseHeight);

    // 2. 再额外缩小，给花朵的半径+花瓣伸展预留边距，避免被画布边缘裁剪
    //    花朵最大伸展 ≈ bloomRadius.max × petalStretch.max = 30（未缩放）
    var margin = 30;
    scale = Math.min(
        scale,
        (heartWidth - 2 * margin) / baseWidth,
        (heartHeight - 2 * margin) / baseHeight
    );

    heartScale = scale;

    // 3. 心形曲线包围盒几何中心 (0, 50.7675) 对齐到画布中心，实现居中
    offsetX = heartWidth / 2;
    offsetY = heartHeight / 2 - 50.7675 * scale;

    $garden = $("#garden");
    gardenCanvas = $garden[0];
    gardenCanvas.width = heartWidth;
    gardenCanvas.height = heartHeight;
    gardenCtx = gardenCanvas.getContext("2d");
    gardenCtx.globalCompositeOperation = "lighter";
    garden = new Garden(gardenCtx, gardenCanvas);

    // 持续渲染
    if (window.gardenInterval) {
        clearInterval(window.gardenInterval);
    }
    window.gardenInterval = setInterval(function () {
        garden.render();
    }, Garden.options.growSpeed);
}

function getHeartPoint(c) {
    var b = c / Math.PI;
    var a = 19.5 * (16 * Math.pow(Math.sin(b), 3)) * heartScale;
    var d = -20 * (13 * Math.cos(b) - 5 * Math.cos(2 * b) - 2 * Math.cos(3 * b) - Math.cos(4 * b)) * heartScale;
    return new Array(offsetX + a, offsetY + d);
}

function startHeartAnimation() {
    var c = 50;
    var d = 10;
    var b = new Array();
    var a = setInterval(function () {
        var h = getHeartPoint(d);
        var e = true;
        for (var f = 0; f < b.length; f++) {
            var g = b[f];
            var j = Math.sqrt(Math.pow(g[0] - h[0], 2) + Math.pow(g[1] - h[1], 2));
            if (j < Garden.options.bloomRadius.max * 1.3) {
                e = false;
                break;
            }
        }
        if (e) {
            b.push(h);
            garden.createRandomBloom(h[0], h[1]);
        }
        if (d >= 30) {
            clearInterval(a);
            showMessages();
        } else {
            d += 0.2;
        }
    }, c);
}

(function (a) {
	a.fn.typewriter = function () {
		this.each(function () {
			var d = a(this), c = d.html(), b = 0;
			d.html("");
			var e = setInterval(function () {
				// 遇到 HTML 注释 <!-- ... --> 时整体跳过，避免注释文本被逐字打出、
				// 以及未闭合注释前缀导致 DOM 内容全部消失
				if (c.substr(b, 4) == "<!--") {
					var end = c.indexOf("-->", b);
					b = (end == -1 ? c.length : end + 3);
				}
				var f = c.substr(b, 1);
				if (f == "<") {
					b = c.indexOf(">", b) + 1
				} else {
					b++
				}
				d.html(c.substring(0, b) + (b & 1 ? "_" : ""));
				if (b >= c.length) {
					clearInterval(e)
				}
			}, 75)
		});
		return this
	}
})(jQuery);

function timeElapse(c) {
    var now = new Date();
    var diff = (now.getTime() - new Date(c).getTime()) / 1000;

    var days = Math.floor(diff / (3600 * 24));
    diff = diff % (3600 * 24);
    var hours = Math.floor(diff / 3600);
    if (hours < 10) hours = "0" + hours;
    diff = diff % 3600;
    var minutes = Math.floor(diff / 60);
    if (minutes < 10) minutes = "0" + minutes;
    diff = diff % 60;
    var seconds = Math.floor(diff);
    if (seconds < 10) seconds = "0" + seconds;

    var html = '<span class="digit">' + days + '</span> 天 ' +
               '<span class="digit">' + hours + '</span> 时 ' +
               '<span class="digit">' + minutes + '</span> 分 ' +
               '<span class="digit">' + seconds + '</span> 秒';
    $("#elapseClock").html(html);
}

function showMessages() {
	adjustWordsPosition();
	$("#messages").fadeIn(3000, function () {
		showLoveU()
	})
}

function adjustWordsPosition() {
	// 将文字定位到 #loveHeart（即心形画布）正中心
	$("#words").css("position", "absolute");
	$("#words").css("top", "50%");
	$("#words").css("left", "50%");
	$("#words").css("transform", "translate(-50%, -50%)");
}

function adjustCodePosition() {
	$("#code").css("margin-top", ($("#garden").height() - $("#code").height()) / 2)
}

function showLoveU() {
    $("#loveu").fadeIn(3000);
}
