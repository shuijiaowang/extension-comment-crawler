
const comments_container=document.querySelector(".comments-el .comments-container")

// 评论容器
const comments_list_container=comments_container.querySelector(".list-container")

const parent_comment_list=comments_list_container.querySelectorAll(".parent-comment")
const parent_comment_item=parent_comment_list[0].querySelector(".comment-item") //这个得是一级子元素
const parent_comment_user_id=parent_comment_item.querySelector(".avatar a").getAttribute("data-user-id")//用户id
const parent_comment_username=parent_comment_item.querySelector(".author a").textContent //用户名
const parent_comment_is_author=parent_comment_item.querySelector(".author span").textContent //存在就是作者 "作者"
const parent_comment_content=parent_comment_item.querySelector(".content").textContent //评论内容
const parent_comment_content_picture=parent_comment_item.querySelector(".comment-picture")?"[图片]":"" //是否有图片
const parent_comment_data=parent_comment_item.querySelector(".date span").textContent //评论时间：05-01,
const parent_comment_location=parent_comment_item.querySelector(".date .location").textContent //IP：广东
const parent_comment_like=parent_comment_item.querySelector(".interactions .like .count").textContent //评论点赞：'赞'=0个
const parent_comment_reply_count=parent_comment_item.querySelector(".reply .count").textContent //子评论数:'回复'=0个


const reply_comment_list=parent_comment_list[1].querySelectorAll(".reply-container .list-container .comment-item") //可能没有二级评论
const reply_comment_item=reply_comment_list[1]
const reply_comment_user_id = reply_comment_item.querySelector(".avatar a").getAttribute("data-user-id")
const reply_comment_username = reply_comment_item.querySelector(".author a").textContent
const reply_comment_is_author = reply_comment_item.querySelector(".author span")?.textContent
const reply_comment_content = reply_comment_item.querySelector(".content").textContent
const reply_comment_date = reply_comment_item.querySelector(".date span").textContent
const reply_comment_location = reply_comment_item.querySelector(".date .location").textContent
const reply_comment_like = reply_comment_item.querySelector(".interactions .like .count").textContent

//点击查看更多
const reply_comment_show_more_button = reply_comment_item.querySelector(".reply-container .show-more")//.click()



document.querySelector(".note-scroller").scrollBy(0,200) //移动
document.querySelector(".note-scroller").scrollTop //判断是否到底

