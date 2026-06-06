const comment_mainContent=document.querySelector('[data-e2e="feed-active-video"]  #merge-all-comment-container .comment-mainContent')
const parent_comment_list=comment_mainContent.querySelectorAll(":scope > div")
const parent_comment_item=parent_comment_list[1].querySelector('[data-e2e="comment-item"]')
const parent_comment_body=parent_comment_item.querySelector(":scope > div:nth-child(2)> div:nth-child(1)")
const parent_comment_body_userlink=parent_comment_body.querySelector(':scope > div:nth-child(1) a').getAttribute("href")
const parent_comment_body_username=parent_comment_body.querySelector(':scope > div:nth-child(1) a').textContent
const parent_comment_body_content=parent_comment_body.querySelector(':scope > div:nth-child(2)').textContent
const parent_comment_body_content_picture=parent_comment_body.querySelector(':scope > div:nth-child(2) >div')?"图片":''
const parent_comment_body_time_loc=parent_comment_body.querySelector(':scope > div:nth-child(3) span').textContent //2周前·吉林,2周前·吉林,2小时前·河北,4月前·山西,2年前·湖北
const parent_comment_body_like_count=parent_comment_body.querySelector(':scope > div:nth-child(4) p span').textContent //点赞数

const reply_comment_show_more_button=parent_comment_item.querySelector(":scope > div:nth-child(2) button div span") //.click,
const parent_comment_body_reply_count=reply_comment_show_more_button.textContent //"展开5条回复"(需要先获取再点击) 点击->不会全部展开，重新获取button元素会变成"展开更多"

const reply_comment_list=parent_comment_item.querySelectorAll('.replyContainer [data-e2e="comment-item"]')
const reply_comment_item=reply_comment_list[0]
const reply_comment_body = reply_comment_item.querySelector(":scope > div:nth-child(2) > div:nth-child(1)");

// 提取回复信息
const reply_comment_body_userlink = reply_comment_body.querySelector(':scope > div:nth-child(1) a').getAttribute("href");
const reply_comment_body_username = reply_comment_body.querySelector(':scope > div:nth-child(1) a').textContent;
const reply_comment_body_content = reply_comment_body.querySelector(':scope > div:nth-child(2)').textContent;
const reply_comment_body_content_picture = reply_comment_body.querySelector(':scope > div:nth-child(2) > div') ? "图片" : '';
const reply_comment_body_time_loc = reply_comment_body.querySelector(':scope > div:nth-child(3) span').textContent; // 例如：2天前·北京
const reply_comment_body_like_count = reply_comment_body.querySelector(':scope > div:nth-child(4) p span').textContent; // 点赞数

//滚动
document.querySelector('[data-e2e="feed-active-video"]  #merge-all-comment-container .comment-mainContent').scrollBy(0,1000)
document.querySelector('[data-e2e="feed-active-video"]  #merge-all-comment-container .comment-mainContent').scrollTop

