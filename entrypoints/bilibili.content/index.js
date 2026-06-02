export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    runAt: 'document_idle',//页面完全加载完成
    // 脚本注入后执行的核心逻辑
    main() {
        // 调用业务模块的初始化函数
        console.log("Example Content Script")



        //评论区域，所有评论区域
        const commentsEl = document.querySelector('bili-comments').shadowRoot.querySelector("#feed");
        //所有评论
        const commentItemList = commentsEl.querySelectorAll("bili-comment-thread-renderer")
        //单个评论区(包含一级和二级)
        const commentItem=commentItemList[0].shadowRoot
        //一级评论
        const commentFirst = commentItem.querySelector("bili-comment-renderer").shadowRoot
        //一级评论的主体
        const commentFirstMain=commentFirst.querySelector("#body #main")
        const commentFirstFooter=commentFirst.querySelector("#body #footer")

        //评论人和评论内容(一二级结构一样)
        const commentUserId = commentFirstMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a") //属性data-user-profile-id
        const commentUserName = commentFirstMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
        const commentContent = commentFirstMain.querySelector("bili-rich-text").shadowRoot.querySelector("#contents").textContent //循环内部元素的textContent //span.

        //二级评论所有
        const commentReplise = commentItem.querySelector("bili-comment-replies-renderer").shadowRoot.querySelector("#expander-contents")
        //二级评论点击查看按钮
        const commentRepliseViewMoreButton=commentReplise.querySelector("#view-more bili-text-button") //直接用.click()方法
        //二级评论多的话会分页，共多少页
        const commentReplisePageSize=commentReplise.querySelector("#pagination-head ").textContent //输出：共10页
        //二级评论所有分页按钮
        const commentReplisePageButton=commentReplise.querySelectorAll("#pagination-body bili-text-button")//data-idx属性是页号，下标从零开始，存在缺省，点击后下次要重新获取所有页号元素// data-idx="0"

        //所有二级评论，先查看是否有commentRepliseViewMoreButton，有则点击，再查看是否有commentReplisePageSize，有则是多页，记录当前是第几页
        //当前所有二级评论
        const commentReplyList = commentReplise.querySelectorAll("#expander-contents bili-comment-reply-renderer")
        const commentReplyItem = commentReplyList[0].shadowRoot
        const commentReplyMain = commentReplyItem.querySelector("#body #main")
        const commentReplyFooter=commentFirst.querySelector("#body #footer")
        const commentReplyUserName = commentReplyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
    },
});
