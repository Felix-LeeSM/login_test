import { Users } from './entity/users.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginType } from './enum/enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
  ) {}
  async getKakaoToken(code: string, res: Response) {
    const redirectToFront = this.configService.get<string>('FRONT_SERVER');
    const clientId = this.configService.get<string>('KAKAO_REST_API_KEY');
    const redirectURL = this.configService.get<string>('KAKAO_REDIRECT_URL');
    const grantType = 'authorization_code';
    const URL = `https://kauth.kakao.com/oauth/token`;
    let accessToken: string;

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirectURL,
        },
      });
      accessToken = result.data.access_token;

      console.log('google:', result.data);
      res.redirect(`${redirectToFront}${accessToken}`);
    } catch (err) {
      throw new HttpException(err, HttpStatus.UNAUTHORIZED);
    }

    // return this.getUserInfoByToken(accessToken, LoginType['kakao'], res);
  }

  async getGoogleToken(code: string, res: Response): Promise<any> {
    const redirectToFront = this.configService.get<string>('FRONT_SERVER');
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientPassword = this.configService.get<string>(
      'GOOGLE_CLIENT_PASSWORD',
    );
    const redirectURL = this.configService.get<string>('GOOGLE_REDIRECT_URL');
    const URL = 'https://oauth2.googleapis.com/token';
    let accessToken = '';

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientPassword,
          redirect_uri: redirectURL,
        },
      });
      accessToken = result.data.access_token;
      /**
       * 현재 구글 access token 발급 받음
       *
       * 임시로 query string으로 front server로 보내주는 중. (리디렉션을 통해서)
       */
      console.log('google:', result.data);
      res.redirect(`${redirectToFront}${accessToken}`);
      // refreshToken = data.refresh_token;
    } catch (err) {
      throw new HttpException(
        `error: ${err.response.data.error}, errorDescription: ${err.response.data.error_description}`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // return this.getUserInfoByToken(accessToken, LoginType['google'], res);
  }

  async getGithubToken(code: string, res: Response) {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientPassword = this.configService.get<string>(
      'GITHUB_CLIENT_PASSWORD',
    );
    const URL = `https://github.com/login/oauth/access_token`;
    let accessToken: string;
    const redirectToFront = this.configService.get<string>('FRONT_SERVER');

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Accept: 'application/json',
        },
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientPassword,
        },
      });
      accessToken = result.data.access_token;
      /**
       * {
        access_token: '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',
        token_type: 'bearer',
        scope: ''
      }
      */
      console.log(result.data);
      res.redirect(`${redirectToFront}${accessToken}`);
    } catch (err) {
      console.error(err);
      throw new HttpException(err, HttpStatus.UNAUTHORIZED);
      return;
    }

    // return this.getUserInfoByToken(accessToken, LoginType['github'], res);
  }

  async getUserInfoByToken(accessToken: string, site: number, res: Response) {
    if (site === LoginType['kakao']) {
      const userInfo = await axios({
        method: 'GET',
        url: `https://kapi.kakao.com/v1/user/access_token_info`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const id = userInfo.data.id;
      // 여기서 DB에 접근해서 해당 유저가 존재하는 지 알아본다.
      const existUser = true;
      // await this.userRepository.findOne({
      //   where: {
      //     loginType: LoginType['kakao'],
      //     loginToken: id.toString(),
      //   },
      // });

      // 여기에 넘겨 줄 정보를 채워넣어야 함.
      return this.createLocalTokenViaUserInfo();
    }

    if (site === LoginType['google']) {
      const userInfo = await axios({
        method: 'POST',
        url: `https://www.googleapis.com/oauth2/v2/userinfo/?accessToken="${accessToken}"`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const id = userInfo.data.id;
      const existUser = true;
      // await this.userRepository.findOne({
      //   where: {
      //     loginType: LoginType['google'],
      //     loginToken: id.toString(),
      //   },
      // });
    }

    if (site === LoginType['github']) {
    }
  }

  async getNovelAccessToken(refreshToken: string) {
    const secret = this.configService.get<string>('MY_SECRET_KEY');
    // const { userId } = jwt.verify(refreshToken, secret).userId;

    return 'new access token';
  }

  existUserLogin(accessToken, loginType, id) {
    console.log('existUser');
    console.log(accessToken, loginType, id);
  }

  novelUserLogin(accessToken, loginType, id) {
    console.log('novelUser');
    console.log(accessToken, loginType, id);
  }

  createLocalTokenViaUserInfo() {
    return;
  }
}
