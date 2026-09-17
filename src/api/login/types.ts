export type UserLoginVO = {
  username: string
  password: string
  captchaVerification: string
  socialType?: string
  socialCode?: string
  socialState?: string
}

export type TokenType = {
  id: number // 编号
  accessToken: string // 访问令牌
  refreshToken: string // 刷新令牌
  userId: number // 用户编号
  userType: number //用户类型
  clientId: string //客户端编号
  expiresTime: number //过期时间
}

export type UserDataAreaVO = {
  headquarterAreaId: number
  headquarterAreaName: string
  ownAreaId?: number
  ownAreaName?: string
  subordinateAreaIds: number[]
  subordinateAreaNames: string[]
  visibleAreaIds: number[]
  visibleAreaNames: string[]
}

export type UserVO = {
  id: number
  username: string
  nickname: string
  deptId: number
  email: string
  mobile: string
  sex: number
  avatar: string
  loginIp: string
  loginDate: string
  dataArea?: UserDataAreaVO
}

export type RegisterVO = {
  tenantName: string
  username: string
  password: string
  captchaVerification: string
}
