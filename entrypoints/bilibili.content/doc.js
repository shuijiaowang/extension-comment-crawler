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
const commentFirstFooter=commentFirst.querySelector("#body #footer bili-comment-action-buttons-renderer").shadowRoot

//评论人id，评论人昵称，评论内容(一二级结构一样)
const commentUserId = commentFirstMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("#user-name").getAttribute('data-user-profile-id') //属性data-user-profile-id
const commentUserName = commentFirstMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
const commentContent = commentFirstMain.querySelector("bili-rich-text").shadowRoot.querySelector("#contents").textContent //循环所有内部元素的textContent ，img.alt属性（表情）
const commentPicture = commentFirstMain.querySelector("#pictures")?"[图片]":"" //是否有图片

//评论时间
const commentTime=commentFirstFooter.querySelector("#pubdate").textContent //'2026-05-13 02:42'
//评论点赞数
const commentLike=commentFirstFooter.querySelector("#like #count").textContent //2010,77964,空字符串''是0,

//二级评论所有
const commentReplise = commentItem.querySelector("bili-comment-replies-renderer").shadowRoot.querySelector("#expander-contents")
//二级评论点击查看按钮
const commentRepliseViewMoreButton=commentReplise.querySelector("#view-more bili-text-button") //直接用.click()方法
//二级评论多的话会分页，共多少页
const commentReplisePageSize=commentReplise.querySelector("#pagination-head ").textContent //输出：共10页
//二级评论所有分页按钮
const commentReplisePageButton=commentReplise.querySelectorAll("#pagination-body bili-text-button")//data-idx属性是页号，下标从零开始，存在缺省，点击后下次要重新获取所有页号元素// data-idx="0"
const commentRepliseExit=commentReplise.querySelectorAll("#pagination-foot bili-text-button") //.click收起。
//所有二级评论，先查看是否有commentRepliseViewMoreButton，有则点击，再查看是否有commentReplisePageSize，有则是多页，记录当前是第几页
//当前所有二级评论
const commentReplyList = commentReplise.querySelectorAll("#expander-contents bili-comment-reply-renderer")
const commentReplyItem = commentReplyList[0].shadowRoot
const commentReplyMain = commentReplyItem.querySelector("#body #main")
const commentReplyFooter=commentReplyItem.querySelector("#body #footer bili-comment-action-buttons-renderer").shadowRoot
const commentReplyUserId=commentReplyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("#user-name").getAttribute('data-user-profile-id')
const commentReplyUserName = commentReplyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
const commentReplyContent = commentReplyMain.querySelector("bili-rich-text").shadowRoot.querySelector("#contents") //循环子节点：文本节点、元素 textContent、img.alt（表情）
const commentReplyPicture = commentReplyMain.querySelector("#pictures")?"[图片]":"" //是否有图片

//评论时间
const commentReplyTime=commentReplyFooter.querySelector("#pubdate ").textContent //'2026-05-13 02:42'
//评论点赞数
const commentReplyLike=commentReplyFooter.querySelector("#like #count").textContent //2010

window.scrollBy(0, 100) //窗口滚动
window.scrollY //判断是否到底