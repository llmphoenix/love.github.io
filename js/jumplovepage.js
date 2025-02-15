
window.onload = initAll;//界面加载完毕后触发initAll函数

function initAll()
{
    document.getElementById("redirect2love").onclick = initRedirect; //redirect元素被点击时触发initRedirect函数
    document.getElementById("redirect2love2").onclick = initRedirect2;//redirect元素被点击时触发initRedirect函数
    document.getElementById("redirect2love3").onclick = initRedirect3;//redirect元素被点击时触发initRedirect函数
}

function initRedirect()
{
    window.location = "html/loveweb/index.html";//设置新页面
    return false;//停止用户对点击的处理
}

function initRedirect2()
{
    window.location = "html/loveweb2/index.html";//设置新页面
    return false;//停止用户对点击的处理
}

function initRedirect3()
{
    window.location = "html/loveweb3/index.html";//设置新页面
    return false;//停止用户对点击的处理
}
