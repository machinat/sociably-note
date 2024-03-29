import {
  makeFactoryProvider,
  BasicProfiler,
  StateController,
  SociablyProfile,
} from '@sociably/core';
import { MessengerUser, MessengerChat } from '@sociably/messenger';
import Telegram, { TelegramUser, TelegramChat } from '@sociably/telegram';
import Line, { LineUser, LineChat } from '@sociably/line';
import getStream from 'get-stream';
import { PROFILE_CACHE_KEY } from '../constant';

type UserInfo = {
  profile: null | SociablyProfile;
};

const useUserProfile = makeFactoryProvider({
  lifetime: 'singleton',
  deps: [StateController, BasicProfiler, Telegram.Profiler, Line.Profiler],
})(
  (stateController, baseProfiler, telegramProfiler, lineProfiler) =>
    async (
      user: MessengerUser | TelegramUser | LineUser,
      chat: MessengerChat | TelegramChat | LineChat
    ): Promise<{ isNewUser: boolean; profile: null | SociablyProfile }> => {
      const userInfo = await stateController
        .userState(user)
        .get<UserInfo>(PROFILE_CACHE_KEY);

      let profile = userInfo?.profile || null;

      if (!userInfo) {
        if (user.platform === 'telegram') {
          const photo = await telegramProfiler.fetchUserPhoto(user);
          let avatarUrl;

          if (photo) {
            const photoData = await getStream(photo.content, {
              encoding: 'base64',
            });
            avatarUrl = `data:${photo.contentType};base64,${photoData}`;
          }

          profile = await telegramProfiler.getUserProfile(user, {
            inChat: chat as TelegramChat,
            avatarUrl,
          });
        } else if (user.platform === 'line') {
          profile = await lineProfiler.getUserProfile(user, {
            inChat: chat as LineChat,
          });
        } else {
          profile = await baseProfiler.getUserProfile(user);
        }

        await stateController
          .userState(user)
          .set<UserInfo>(PROFILE_CACHE_KEY, { profile });
      }

      return { isNewUser: !userInfo, profile };
    }
);

export default useUserProfile;
