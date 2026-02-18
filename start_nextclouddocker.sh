docker run -d 
  --name nextcloud-dev			# Set the name of the docker (unsure if it's image or volume or whatever)
  -p 8080:80				# Set the ports of the docker image
  -v nextcloud_dev_data:/var/www/html	# Set the name of the volume, followed by file path
  nextcloud:latest 			# Name of docker image : branch/version of said image
