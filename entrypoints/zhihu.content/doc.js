

const parent_comment_list = document.querySelectorAll(".Modal-content > div > div:nth-child(2) > div > div")
const parent_comment_item=parent_comment_list[0]
const parent_comment_body=parent_comment_item.querySelector(":scope > div > div:nth-child(2)")
const parent_comment_user=parent_comment_body.querySelector(":scope > div:nth-child(1) a") //href,textContent
const parent_comment_link=parent_comment_user.getAttribute("href") //https://www.zhihu.com/people/cc69705075a50c78eb69135e591fd513
const parent_comment_username=parent_comment_user.textContent //用户名
const parent_comment_content=parent_comment_body.querySelector(":scope > div:nth-child(2)").textContent  //评论内容

const parent_comment_footer=parent_comment_body.querySelector(":scope > div:nth-child(3)") //时间/地点/点赞数
const parent_comment_data_loc=parent_comment_footer.querySelector(":scope > div:nth-child(1)>div:nth-child(1)").textContent //'05-17 · 甘肃 · 热评',根据点号分割，前两个一个是热评一个是地点
const parent_comment_like=parent_comment_footer.querySelector(":scope > div:nth-child(2)>button:nth-child(2)").textContent //点赞数：'711'

const parent_comment_show_more_button=parent_comment_item.querySelector(":scope > button") //点击查看全部回复

const reply_comment_list = document.querySelectorAll(".Modal-content > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) div")
const reply_comment_item = reply_comment_list[0]

const reply_comment_body=reply_comment_item.querySelector(":scope > div > div:nth-child(2)")
const reply_comment_user=reply_comment_body.querySelector(":scope > div:nth-child(1) a") //href,textContent
const reply_comment_link=reply_comment_user.getAttribute("href") //https://www.zhihu.com/people/cc69705075a50c78eb69135e591fd513
const reply_comment_username=reply_comment_user.textContent //用户名
const reply_comment_content=reply_comment_body.querySelector(":scope > div:nth-child(2)").textContent  //评论内容

const reply_comment_footer=reply_comment_body.querySelector(":scope > div:nth-child(3)") //时间/地点/点赞数
const reply_comment_data_loc=reply_comment_footer.querySelector(":scope > div:nth-child(1)>div:nth-child(1)").textContent //'05-17 · 甘肃 · 热评',根据点号分割，前两个一个是热评一个是地点
const reply_comment_like=reply_comment_footer.querySelector(":scope > div:nth-child(2)>button:nth-child(2)").textContent //点赞数：'711'


