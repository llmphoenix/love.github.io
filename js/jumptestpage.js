window.onload = initAll;//界面加载完毕后触发initAll函数

function initAll()
{
    document.getElementById("redirect").onclick = initRedirect;//redirect元素被点击时触发initRedirect函数
}

function initRedirect()
{
    window.location = "html/goto_0.html";//设置新页面
    return false;//停止用户对点击的处理
}
