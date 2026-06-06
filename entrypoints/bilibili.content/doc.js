//评论区域容器
const commentsContainer = document.querySelector('bili-comments').shadowRoot.querySelector("#feed");
//所有一级评论项
const parentCommentList = commentsContainer.querySelectorAll("bili-comment-thread-renderer")
//单个一级评论项（含一级与二级）
const parentCommentItem = parentCommentList[0].shadowRoot
//一级评论渲染器
const parentCommentRenderer = parentCommentItem.querySelector("bili-comment-renderer").shadowRoot
//一级评论主体
const parentCommentMain = parentCommentRenderer.querySelector("#body #main")
//一级评论底部（时间/点赞等）
const parentCommentFooter = parentCommentRenderer.querySelector("#body #footer bili-comment-action-buttons-renderer").shadowRoot

//评论人ID
const userId = parentCommentMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("#user-name").getAttribute('data-user-profile-id')
//评论人昵称
const userName = parentCommentMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
//评论人主页链接
const userLink = parentCommentMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").getAttribute('href')
//评论内容（循环子节点：文本节点 textContent、img.alt 表情）
const content = parentCommentMain.querySelector("bili-rich-text").shadowRoot.querySelector("#contents").textContent
//是否有图片
const picture = parentCommentMain.querySelector("#pictures") ? "[图片]" : ""
//评论时间
const time = parentCommentFooter.querySelector("#pubdate").textContent
//评论地点（本站无）
const location = ""
//点赞数
const like = parentCommentFooter.querySelector("#like #count").textContent
//是否作者（本站无）
const isAuthor = ""
//评论标签（本站无）
const tag = ""

//二级评论容器
const replyContainer = parentCommentItem.querySelector("bili-comment-replies-renderer").shadowRoot.querySelector("#expander-contents")
//展开更多回复按钮
const replyShowMoreButton = replyContainer.querySelector("#view-more bili-text-button")
//二级评论分页信息
const replyPageSize = replyContainer.querySelector("#pagination-head ").textContent
//二级评论分页按钮（data-idx 为页号，下标从 0 开始，存在缺省，点击后需重新获取）
const replyPageButtons = replyContainer.querySelectorAll("#pagination-body bili-text-button")
//收起二级评论按钮
const replyCollapseButton = replyContainer.querySelectorAll("#pagination-foot bili-text-button")
//所有二级评论
const replyList = replyContainer.querySelectorAll("#expander-contents bili-comment-reply-renderer")
//单个二级评论
const replyItem = replyList[0].shadowRoot
//二级评论主体
const replyMain = replyItem.querySelector("#body #main")
//二级评论底部
const replyFooter = replyItem.querySelector("#body #footer bili-comment-action-buttons-renderer").shadowRoot

//评论人ID（二级，字段名与一级相同）
const userId = replyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("#user-name").getAttribute('data-user-profile-id')
//评论人昵称
const userName = replyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").textContent
//评论人主页链接
const userLink = replyMain.querySelector("bili-comment-user-info").shadowRoot.querySelector("a").getAttribute('href')
//评论内容
const content = replyMain.querySelector("bili-rich-text").shadowRoot.querySelector("#contents")
//是否有图片
const picture = replyMain.querySelector("#pictures") ? "[图片]" : ""
//评论时间
const time = replyFooter.querySelector("#pubdate ").textContent
//评论地点（本站无）
const location = ""
//点赞数
const like = replyFooter.querySelector("#like #count").textContent

//滚动容器（窗口滚动）
const scrollContainer = window
scrollContainer.scrollBy(0, 100)
scrollContainer.scrollY
