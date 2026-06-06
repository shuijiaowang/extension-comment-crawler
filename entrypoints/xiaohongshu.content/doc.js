//评论区域容器
const commentsContainer = document.querySelector(".comments-el .comments-container")
//评论列表容器
const commentListContainer = commentsContainer.querySelector(".list-container")
//所有一级评论项
const parentCommentList = commentListContainer.querySelectorAll(".parent-comment")
//单个一级评论项
const parentCommentItem = parentCommentList[0].querySelector(".comment-item")

//评论人ID
const userId = parentCommentItem.querySelector(".avatar a").getAttribute("data-user-id")
//评论人昵称
const userName = parentCommentItem.querySelector(".author a").textContent
//评论人主页链接
const userLink = parentCommentItem.querySelector(".avatar a").getAttribute("href")
//是否作者
const isAuthor = parentCommentItem.querySelector(".author span").textContent
//评论内容
const content = parentCommentItem.querySelector(".content").textContent
//是否有图片
const picture = parentCommentItem.querySelector(".comment-picture") ? "[图片]" : ""
//评论时间
const time = parentCommentItem.querySelector(".date span").textContent
//评论地点
const location = parentCommentItem.querySelector(".date .location").textContent
//点赞数
const like = parentCommentItem.querySelector(".interactions .like .count").textContent
//评论标签（本站无）
const tag = ""
//回复数量
const replyCount = parentCommentItem.querySelector(".reply .count").textContent
//展开更多回复按钮
const replyShowMoreButton = parentCommentList[0].querySelector(".reply-container .show-more")

//所有二级评论
const replyList = parentCommentList[1].querySelectorAll(".reply-container .list-container .comment-item")
//单个二级评论
const replyItem = replyList[1]

//评论人ID
const userId = replyItem.querySelector(".avatar a").getAttribute("data-user-id")
//评论人昵称
const userName = replyItem.querySelector(".author a").textContent
//评论人主页链接
const userLink = replyItem.querySelector(".avatar a").getAttribute("href")
//是否作者
const isAuthor = replyItem.querySelector(".author span")?.textContent
//评论内容
const content = replyItem.querySelector(".content").textContent
//是否有图片
const picture = replyItem.querySelector(".comment-picture") ? "[图片]" : ""
//评论时间
const time = replyItem.querySelector(".date span").textContent
//评论地点
const location = replyItem.querySelector(".date .location").textContent
//点赞数
const like = replyItem.querySelector(".interactions .like .count").textContent

//滚动容器
const scrollContainer = document.querySelector(".note-scroller")
scrollContainer.scrollBy(0, 200)
scrollContainer.scrollTop
