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


// https://api.bilibili.com/x/v2/reply/wbi/main?oid=898762590&type=1&mode=3&pagination_str=%7B%22offset%22:%22CAESEDE4MjM3MjA3OTA5MjYwOTYiAggB%22%7D&plat=1&web_location=1315875&w_rid=0f6d8e2f175ef9f98384a0d850abfd06&wts=1780977345
// data.replies[0]
const replies={
    "type": 1,                         // 评论类型：1=视频 11=动态 17=专栏
    "rcount": 1,                       // 回复数量
    "state": 0,                        // 评论状态
    "fansgrade": 0,                    // 粉丝等级
    "attr": 512,                       // 评论属性标记
    "ctime": 1764204973,               // 评论发布时间（Unix时间戳）
    "oid_str": "114900290570272",      // 目标对象ID（视频ID、动态ID等）
    "rpid_str": "281724574529",        // 评论ID
    "root_str": "0",                   // 根评论ID（主评论为0）
    "parent_str": "0",                 // 父评论ID（回复谁就是谁）
    "dialog_str": "0",                 // 对话链ID
    "like": 0,                         // 点赞数
    "member": {
        "mid": "437872578",            // 用户UID
        "uname": "81079077992_bili",   // 用户昵称
        "sex": "女",                   // 性别
        "sign": "",                    // 个性签名
        "avatar": "http://...",        // 用户头像URL
        "face_nft_new": 0,             // NFT头像标记（已基本废弃）
        "is_senior_member": 0,         // 是否资深会员
        "level_info": {
            "current_level": 4         // 用户等级（Lv0~Lv6）
        },
        "vip": {
            "vipType": 1,              // 会员类型
            "vipStatus": 0             // 是否为有效大会员
        },
        "user_sailing_v2": {},         // 用户装扮信息（头像框、卡片背景等）
        "is_contractor": false         // 是否签约创作者/MCN成员
    },
    "content": {
        "message": "报名报名",          // 评论内容,祝6688组合健康长寿[爱心],包含emote
        "picture_scale":1, //图片数量？
        "pictures":[{
            "img_src": "https://i0.hdslb.com/bfs/new_dyn/5caec58050b01bea3a19e916c9a44d021029353971.jpg",
            "img_width": 1054,
            "img_height": 1141,
            "img_size": 666.64
        }],
        "at_name_to_mid_str":{
            "倾国恋倾城":"123106872" //父评论者
        },
        "members":[0] //父评论
    },
    "replies":[],//有些评论的子评论可能就两个，默认就展开了，就不需要点击查看更多。但是又的又被省略了，需要手动点开
    "assist": 0,                       // 辅助状态（用途未知，可忽略）
    "up_action": {
        "like": false,                 // 当前登录用户是否已点赞
        "reply": true                  // 当前登录用户是否参与回复
    },
    "invisible": false,                // 评论是否不可见
    "reply_control": {
        "up_reply": true,              // 是否包含UP主回复
        "max_line": 6,                 // 前端最大显示行数
        "time_desc": "194天前发布",     // 格式化时间
        "location": "IP属地：广东"      // IP属地
    }
}

//api.bilibili.com/x/v2/reply/reply?oid=898762590&type=1&root=122609827280&ps=10&pn=1&web_location=333.788
//点击查看
let data={
    "page":{
        "num": 1,
        "size": 10,
        "count": 46
    },
    "replies":[{},{}]
}
