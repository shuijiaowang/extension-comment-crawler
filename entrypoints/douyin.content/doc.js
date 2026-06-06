//评论区域容器
const commentsContainer = document.querySelector('[data-e2e="feed-active-video"] #merge-all-comment-container .comment-mainContent')
//所有一级评论项
const parentCommentList = commentsContainer.querySelectorAll(":scope > div")
//单个一级评论项
const parentCommentItem = parentCommentList[1].querySelector('[data-e2e="comment-item"]')
//一级评论主体
const parentCommentMain = parentCommentItem.querySelector(":scope > div:nth-child(2)> div:nth-child(1)")

//评论人主页链接
const userLink = parentCommentMain.querySelector(':scope > div:nth-child(1) a').getAttribute("href")
//评论人昵称
const userName = parentCommentMain.querySelector(':scope > div:nth-child(1) a').textContent
//评论人ID（从主页链接提取）
const userId = userLink.split('/').pop()
//评论内容
const content = parentCommentMain.querySelector(':scope > div:nth-child(2)').textContent
//是否有图片
const picture = parentCommentMain.querySelector(':scope > div:nth-child(2) >div') ? "[图片]" : ''
//评论时间·地点（用 · 分割）
const timeLoc = parentCommentMain.querySelector(':scope > div:nth-child(3) span').textContent
//评论时间
const time = timeLoc.split('·')[0]
//评论地点
const location = timeLoc.split('·')[1]
//点赞数
const like = parentCommentMain.querySelector(':scope > div:nth-child(4) p span').textContent
//是否作者（本站无）
const isAuthor = ""
//评论标签（本站无）
const tag = ""

//展开更多回复按钮（先取 replyCount 再点击；点击后文案变为「展开更多」）
const replyShowMoreButton = parentCommentItem.querySelector(":scope > div:nth-child(2) button div span")
//回复数量
const replyCount = replyShowMoreButton.textContent

//所有二级评论
const replyList = parentCommentItem.querySelectorAll('.replyContainer [data-e2e="comment-item"]')
//单个二级评论
const replyItem = replyList[0]
//二级评论主体
const replyMain = replyItem.querySelector(":scope > div:nth-child(2) > div:nth-child(1)")

//评论人主页链接
const userLink = replyMain.querySelector(':scope > div:nth-child(1) a').getAttribute("href")
//评论人昵称
const userName = replyMain.querySelector(':scope > div:nth-child(1) a').textContent
//评论人ID
const userId = userLink.split('/').pop()
//评论内容
const content = replyMain.querySelector(':scope > div:nth-child(2)').textContent
//是否有图片
const picture = replyMain.querySelector(':scope > div:nth-child(2) > div') ? "[图片]" : ''
//评论时间·地点
const timeLoc = replyMain.querySelector(':scope > div:nth-child(3) span').textContent
//评论时间
const time = timeLoc.split('·')[0]
//评论地点
const location = timeLoc.split('·')[1]
//点赞数
const like = replyMain.querySelector(':scope > div:nth-child(4) p span').textContent

//滚动容器
const scrollContainer = document.querySelector('[data-e2e="feed-active-video"] #merge-all-comment-container .comment-mainContent')
scrollContainer.scrollBy(0, 1000)
scrollContainer.scrollTop
