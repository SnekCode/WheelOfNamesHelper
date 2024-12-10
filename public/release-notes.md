## Wheel of Names Changelog 
___________________________________________________________________________________________
___________________________________________________________________________________________

### Version 2.0.2

#### Bug Fix
- Youtube auth token expiration is now saved as a timestamp allowing for calculating the time remaining on app restart which could cause missing a refresh 
- Youtube customUrl is now used as the channel name in case customUrl and name are different. Due to the url youtube.com/@handle/live required to determine broadcast status
- !wheel / !here command counts fixed. Improper use of enums caused the issue
___________________________________________________________________________________________
___________________________________________________________________________________________

### Version 2.0.1

#### Bug Fix
- Twitch Auth Redirect in production build does not function like in dev. This has been fixed.
___________________________________________________________________________________________
___________________________________________________________________________________________

### Version 2.0.0

#### Features
- Authentication methods for Youtube and Twitch added to the menus
  - Application manages refresh tokens as well
  - YouTube will Refresh tokens while app is live. Google access tokens expire after one hour requiring sign in.
  - Check marks on main window indicated authentication status
- YouTube chat will now auto connect! No more button presses!!!
- New chat command !odds added. This command will send a message back to the viewer informing them of the odds of winning
  - Possible Messages:
    - @user your odds of winning are xx.xx% and you have x entries
    - @user your odds of winning are xx.xx% and you have x entries you can double your odds by typing !here
    - @user you have not entered the wheel yet with !wheel
- Message box will now show the service the viewer is on


___________________________________________________________________________________________
___________________________________________________________________________________________

### Version 1.2.0

#### Features
- Added twitch and youtube channel Ids to meta data to prevent same name collisions
- Added timestamp to meta data so on entry winning the amount of time since last activity will be shown
- Added time stamp data to entry cards on main screen
- Added three card sorting options. Activity, Weight and Alphabetical
- Added Remove Not Claimed Button ! Caution this will remove viewers from the list
  - Recommended workflow is to remove a not claimed before starting stream. Then reset the !here command

#### Notes
- As viewers chat their channelIDs will be added in the meta data. The chances of name collisions will decrease over time.
- Initially viewers that have no activity data who win on the wheel will have the winning message be set to "You're Next!"
___________________________________________________________________________________________
___________________________________________________________________________________________

### Version 1.1.0

#### Features
- Added a Release Notes feature modal that will display future changes
- These notes can be viewed at any time by using the file menu:
* ["Help -> changelog"]()

#### Notes
- Previous changelogs are brief summaries due to no changelogs being produced at the time.

___________________________________________________________________________________________
___________________________________________________________________________________________
### Version 1.0.0

#### Features
- Added Youtube Chat Support
  - You can now add your Youtube handle and connect to the current live broadcast

___________________________________________________________________________________________
___________________________________________________________________________________________

### Dark Ages Prior to v1.0.0

#### Features
- Twitch chat support
- Manual add viewers to list
- Integrated Wheel of Names website into the application.
- Auto updating Wheel of Names as chat commands are received
- Implemented command !wheel 
- Implemented command !here 
- Implemented command !remove
- Implemented clear chances button
- Implemented viewer search/filter input box
- Wheel of Names ad blocker
___________________________________________________________________________________________
___________________________________________________________________________________________