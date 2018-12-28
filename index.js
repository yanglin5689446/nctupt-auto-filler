
require('isomorphic-fetch')
const moment = require('moment')
const fs = require('fs')
const FormData = require('form-data')

function timeout (ms, promise){
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(resolve, reject)
  })
}

class PT {
  constructor(config){
    this.config = config
    this.cookie = null
  }

  async login (){
    try{
      const { account, password } = this.config
      const loginUrl = 'https://pt-attendance.nctu.edu.tw/verify/chkLogin.php'
      const body = new FormData()
      body.append('Account', account)
      body.append('Password', password)

      const response = await fetch(loginUrl, {
        method: 'post',
        body
      })
      const cookie = response.headers.get('set-cookie')
      this.cookie = cookie
    } catch(e){
      console.log(e)
    }
  }

  computeFillableTimeslots(){

  }

  async autoFill(){
    let accum = 0
    const { total } = this.config
    const { month, from, to } = this.config
    for(let i = from; i <= to; i ++){
      const day = `${month}-${("0" + i).slice(-2)}`
      const first = await pt.addWork(`${day} 8:00:00`, `${day} 12:00:00`, '協助資訊競賽：題組準備')
      if(first) accum += 4
      if(accum >= total) break;
      const second = await pt.addWork(`${day} 13:00:00`, `${day} 17:00:00`, '協助資訊競賽：題組準備')
      if(second) accum += 4
      if(accum >= total) break;
    }
  }

  async check(settings){
    try{
      const url = 'https://pt-attendance.nctu.edu.tw/ajaxfunction.php'
      const body = new FormData()
      Object.entries(settings).forEach(([key, value]) => body.append(key, value))
      const response = await timeout(3000, fetch(url, {
        method: 'post',
        headers: {
          'Cookie': this.cookie
        },
        body
      }))
      const text = await response.text()
      return !!(text.charAt(0) === 'Y')
    } catch(e){
      return false
    }
  }

  async validateTime(start, end){
    const { account, works } = this.config
    const results = await Promise.all([
      this.check({ Date1: start, Date2: end, UserID: account, actionFunction: 'IsRightWorkTime' }),
      this.check({
        checkdate: start.substring(0, 10),
        checkmomth: end.substring(0, 7),
        SerialNo: 0,
        UserID: account,
        PTEId: works.PTEId,
        diff: 4,
        actionFunction: 'checkWorkOver'
      }),
      this.check({ checkdate: start.substring(0, 10), UserID: account, actionFunction: 'check5Days' }),
      this.check({ Date1: start, Date2: end, UserID: account, actionFunction: 'CheckClass' }),
    ])
    return !results.includes(false)
  }


  async addWork (start, end, description=''){
    try{
      const url = 'https://pt-attendance.nctu.edu.tw/ajaxfunction.php'
      const ok = await this.validateTime(start, end)
      if(!ok) return false

      const settings = {
        workT: 1,
        workS: start,
        workE: end,
        workD: description,
        workUnit: 0,
        actionFunction:'workAdd',
        ...this.config.works
      }
      const body = new FormData()
      Object.entries(settings).forEach(([key, value]) => body.append(key, value))
      await timeout(3000, fetch(url, {
        method: 'post',
        headers: {
          'Cookie': this.cookie
        },
        body
      }))
      return true
    } catch(e){
      return false
    }
  }

  static fromConfig(){

  }

  static loadConfig(configName = 'pt.config.json'){
    const raw = fs.readFileSync(configName)
    return JSON.parse(raw)
  }
}


(function main(){
  const settings = PT.loadConfig()
  pt = new PT(settings)
  pt.login()
  .then(() => pt.autoFill())
})()
