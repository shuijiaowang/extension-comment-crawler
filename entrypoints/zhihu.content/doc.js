//所有一级评论项
const parentCommentList = document.querySelectorAll(".Modal-content > div > div:nth-child(2) > div > div")
//单个一级评论项
const parentCommentItem = parentCommentList[0]
//一级评论主体
const parentCommentMain = parentCommentItem.querySelector(":scope > div > div:nth-child(2)")

//评论人主页链接
const userLink = parentCommentMain.querySelector(":scope > div:nth-child(1) a").getAttribute("href")
//评论人昵称
const userName = parentCommentMain.querySelector(":scope > div:nth-child(1) a").textContent
//评论人ID（从主页链接提取）
const userId = userLink.split('/').pop()
//评论内容
const content = parentCommentMain.querySelector(":scope > .CommentContent").textContent
//是否有图片
const picture = parentCommentMain.querySelector(":scope > .CommentContent .comment_img") ? "[图片]" : ""
//一级评论底部（时间/地点/点赞）
const parentCommentFooter = parentCommentMain.querySelector(":scope > div:nth-child(3)")
//评论时间·地点·标签（用 · 分割）
const timeLocTag = parentCommentFooter.querySelector(":scope > div:nth-child(1)>div:nth-child(1)").textContent
//评论时间
const time = timeLocTag.split('·')[0]
//评论地点
const location = timeLocTag.split('·')[1]
//评论标签（如热评）
const tag = timeLocTag.split('·')[2]
//点赞数
const like = parentCommentFooter.querySelector(":scope > div:nth-child(2)>button:nth-child(2)").textContent
//是否作者（本站无）
const isAuthor = ""

//展开更多回复按钮（点击后打开回复悬浮层）
const replyShowMoreButton = parentCommentItem.querySelector(":scope > button")

//滚动容器（一级评论页）
const scrollContainer = document.querySelector(".Modal-content > div > div:nth-child(2)")
scrollContainer.scrollBy(0, 100)
scrollContainer.scrollTop

//所有二级评论（回复悬浮层）
const replyList = document.querySelectorAll(".Modal-content > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div")
//单个二级评论
const replyItem = replyList[0]
//二级评论主体
const replyMain = replyItem.querySelector(":scope > div > div:nth-child(2)")

//评论人主页链接
const userLink = replyMain.querySelector(":scope > div:nth-child(1) a").getAttribute("href")
//评论人昵称
const userName = replyMain.querySelector(":scope > div:nth-child(1) a").textContent
//评论人ID
const userId = userLink.split('/').pop()
//评论内容
const content = replyMain.querySelector(":scope > .CommentContent").textContent
//是否有图片
const picture = replyMain.querySelector(":scope > .CommentContent .comment_img") ? "[图片]" : ""
//二级评论底部
const replyFooter = replyMain.querySelector(":scope > div:nth-child(3)")
//评论时间·地点·标签
const timeLocTag = replyFooter.querySelector(":scope > div:nth-child(1)>div:nth-child(1)").textContent
//评论时间
const time = timeLocTag.split('·')[0]
//评论地点
const location = timeLocTag.split('·')[1]
//评论标签
const tag = timeLocTag.split('·')[2]
//点赞数
const like = replyFooter.querySelector(":scope > div:nth-child(2)>button:nth-child(2)").textContent

//返回一级评论按钮
const returnParentButton = document.querySelector(".Modal-content > div:nth-child(2) > div:nth-child(1) span")
//滚动容器（二级评论页）
const replyScrollContainer = document.querySelector(".Modal-content > div:nth-child(2) > div:nth-child(2)")
replyScrollContainer.scrollBy(0, 100)
replyScrollContainer.scrollTop
